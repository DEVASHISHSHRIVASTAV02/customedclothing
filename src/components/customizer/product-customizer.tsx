"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NextImage from "next/image";
import { AreaKey, AREA_KEYS, AREA_LABELS } from "@/lib/constants";
import { getCanvasClothingImageSrc, getClothingImageSrc } from "@/lib/clothing-assets";
import {
  createPreviewSessionId,
  getOrCreateDesignSessionId,
  readPreviewSession,
  savePreviewSession,
} from "@/lib/client-session";
import { isComposedPreviewSource } from "@/lib/preview-source";
import { formatInr } from "@/lib/utils";
import { formatTimeIst } from "@/lib/time";
import { useAuthModal } from "@/components/auth/customer-auth-modal-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const CANVAS_SIZE = 640;
const CANVAS_PADDING = 16;
const GARMENT_LAYER_NAME = "__garment_backdrop__";
const STEP5_EDIT_OBJECT_NAME = "__step5_edit__";
const MIN_CANVAS_ZOOM = 1;
const MAX_CANVAS_ZOOM = 8;

function clampCanvasZoom(value: number) {
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
}

type Variant = {
  id: string;
  colorCode: string;
  colorName: string;
  sizeCode: string;
  basePriceInr: number;
};

type PrintArea = {
  id: string;
  code: AreaKey;
  addonPriceInr: number;
  textureSlot: string;
};

type ProductPayload = {
  id: string;
  slug: string;
  name: string;
  variants: Variant[];
  printAreas: PrintArea[];
};

type ProductCustomizerProps = {
  product: ProductPayload;
  initialDraftId?: string;
  initialSessionId?: string;
  initialAreas?: AreaKey[];
  initialStep?: number;
};

type ExistingDraftPayload = {
  id: string;
  productVariant?: {
    colorCode?: string;
    sizeCode?: string;
  };
  designJsonByArea?: Partial<Record<AreaKey, Record<string, unknown>>>;
  previewImageUrls?: Partial<Record<AreaKey, string>>;
  layerPreviewImageUrls?: Partial<Record<AreaKey, Partial<Record<LayerPreviewType, string>>>>;
};

type FabricModule = typeof import("fabric");
type CanvasTextObject = import("fabric").Textbox;
type CanvasImageObject = import("fabric").FabricImage & {
  __originalUploadSrc?: string;
  __backgroundRemoved?: boolean;
};
type LayerPreviewType = "text" | "upload" | "edit";
type AreaLayerPreviewMap = Partial<Record<LayerPreviewType, string>>;
type AreaState = {
  json?: string;
  previewDataUrl?: string;
  layerPreviewDataUrls?: AreaLayerPreviewMap;
};

type HistoryStack = {
  undo: string[];
  redo: string[];
};

type SaveDraftOptions = {
  manual?: boolean;
  saveToAccount?: boolean;
};

type AreaSelectorOption = {
  id: string;
  area: AreaKey;
  label: string;
};

type SizeChartUnit = "in" | "cm";

type SizeChartMeasurements = {
  chest: number;
  shoulders: number;
  sleeveWidth: number;
  sleeveLength: number;
};

function getObjectName(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function isStep5EditObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (getObjectName(value) === STEP5_EDIT_OBJECT_NAME) {
    return true;
  }

  const type = (value as { type?: unknown }).type;
  return type === "path" || type === "rect" || type === "circle";
}

function asCanvasTextObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const type = (value as { type?: unknown }).type;
  if (type !== "textbox") {
    return null;
  }

  return value as CanvasTextObject;
}

function asCanvasImageObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { type?: unknown; name?: unknown };
  if (candidate.type !== "image" || candidate.name === GARMENT_LAYER_NAME) {
    return null;
  }

  return value as CanvasImageObject;
}

function getLayerPreviewTypeFromCanvasObject(value: unknown): LayerPreviewType | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (getObjectName(value) === GARMENT_LAYER_NAME) {
    return null;
  }

  const type = (value as { type?: unknown }).type;
  if (type === "textbox") {
    return "text";
  }
  if (type === "image") {
    return "upload";
  }
  return "edit";
}

function fitImageWithinCanvas(
  image: {
    width?: number;
    height?: number;
    scale: (value: number) => unknown;
    set: (options: Record<string, unknown>) => unknown;
  },
  maxWidth: number,
  maxHeight: number,
  upscale = true,
) {
  const sourceWidth = typeof image.width === "number" && image.width > 0 ? image.width : maxWidth;
  const sourceHeight = typeof image.height === "number" && image.height > 0 ? image.height : maxHeight;
  let targetScale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  if (!upscale) {
    targetScale = Math.min(targetScale, 1);
  }

  if (!Number.isFinite(targetScale) || targetScale <= 0) {
    targetScale = 1;
  }

  image.scale(targetScale);
  image.set({
    originX: "center",
    originY: "center",
    left: CANVAS_SIZE / 2,
    top: CANVAS_SIZE / 2,
  });
}

function defaultAreaStateRecord() {
  return AREA_KEYS.reduce<Record<AreaKey, AreaState>>((acc, area) => {
    acc[area] = {};
    return acc;
  }, {} as Record<AreaKey, AreaState>);
}

function defaultHistoryRecord() {
  return AREA_KEYS.reduce<Record<AreaKey, HistoryStack>>((acc, area) => {
    acc[area] = { undo: [], redo: [] };
    return acc;
  }, {} as Record<AreaKey, HistoryStack>);
}

async function readResponseJson<T extends Record<string, unknown>>(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as Partial<T> & { error?: unknown };
  }

  try {
    return JSON.parse(text) as Partial<T> & { error?: unknown };
  } catch {
    return {} as Partial<T> & { error?: unknown };
  }
}

function responseErrorMessage(data: { error?: unknown }, fallback: string) {
  if (typeof data.error !== "string") {
    return fallback;
  }

  const value = data.error.trim();
  return value.length > 0 ? value : fallback;
}

function normalizeSelectedAreas(areas: AreaKey[] | undefined): AreaKey[] {
  if (!areas || areas.length === 0) {
    return ["front"];
  }

  const uniqueAreas = Array.from(new Set(areas));
  return uniqueAreas.length > 0 ? uniqueAreas : ["front"];
}

function hasDesignObjectsInAreaJson(json?: string) {
  if (!json || json.trim().length === 0) {
    return false;
  }

  try {
    const parsed = JSON.parse(json) as { objects?: unknown };
    return Array.isArray(parsed.objects) && parsed.objects.length > 0;
  } catch {
    return false;
  }
}

function hasAreaSnapshotData(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.keys(value as Record<string, unknown>).length > 0;
}

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return fallback;
}

function sampleAverageColorInRect(
  data: Uint8ClampedArray,
  width: number,
  xStart: number,
  yStart: number,
  xEnd: number,
  yEnd: number,
) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const index = (y * width + x) * 4;
      r += data[index] ?? 0;
      g += data[index + 1] ?? 0;
      b += data[index + 2] ?? 0;
      count += 1;
    }
  }

  if (count === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number) {
  const sampleSize = Math.max(4, Math.round(Math.min(width, height) * 0.04));
  const topLeft = sampleAverageColorInRect(data, width, 0, 0, sampleSize, sampleSize);
  const topRight = sampleAverageColorInRect(data, width, Math.max(0, width - sampleSize), 0, width, sampleSize);
  const bottomLeft = sampleAverageColorInRect(data, width, 0, Math.max(0, height - sampleSize), sampleSize, height);
  const bottomRight = sampleAverageColorInRect(data, width, Math.max(0, width - sampleSize), Math.max(0, height - sampleSize), width, height);

  return {
    r: Math.round((topLeft.r + topRight.r + bottomLeft.r + bottomRight.r) / 4),
    g: Math.round((topLeft.g + topRight.g + bottomLeft.g + bottomRight.g) / 4),
    b: Math.round((topLeft.b + topRight.b + bottomLeft.b + bottomRight.b) / 4),
  };
}

function colorDistanceFromBackground(
  r: number,
  g: number,
  b: number,
  background: { r: number; g: number; b: number },
) {
  return Math.max(
    Math.abs(r - background.r),
    Math.abs(g - background.g),
    Math.abs(b - background.b),
  );
}

function removeBackgroundFromImageElement(imageElement: HTMLImageElement) {
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;
  if (width <= 0 || height <= 0) {
    throw new Error("Unable to process image.");
  }

  const processingCanvas = document.createElement("canvas");
  processingCanvas.width = width;
  processingCanvas.height = height;
  const context = processingCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Unable to process image.");
  }

  context.drawImage(imageElement, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const background = estimateBackgroundColor(pixels, width, height);
  const threshold = IMAGE_BACKGROUND_REMOVAL_THRESHOLD;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  let queueIndex = 0;

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const pointIndex = y * width + x;
    if (visited[pointIndex] === 1) {
      return;
    }
    visited[pointIndex] = 1;
    queue.push(pointIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queueIndex < queue.length) {
    const pointIndex = queue[queueIndex] ?? 0;
    queueIndex += 1;
    const x = pointIndex % width;
    const y = Math.floor(pointIndex / width);
    const pixelIndex = pointIndex * 4;
    const r = pixels[pixelIndex] ?? 0;
    const g = pixels[pixelIndex + 1] ?? 0;
    const b = pixels[pixelIndex + 2] ?? 0;
    const a = pixels[pixelIndex + 3] ?? 255;
    const distance = colorDistanceFromBackground(r, g, b, background);

    if (a > 0 && distance > threshold) {
      continue;
    }

    pixels[pixelIndex + 3] = 0;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  // Expand removal around already-transparent edges to eliminate visible halos.
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const pixelIndex = (y * width + x) * 4;
        if ((pixels[pixelIndex + 3] ?? 255) === 0) {
          continue;
        }

        const r = pixels[pixelIndex] ?? 0;
        const g = pixels[pixelIndex + 1] ?? 0;
        const b = pixels[pixelIndex + 2] ?? 0;
        const distance = colorDistanceFromBackground(r, g, b, background);
        if (distance > threshold + 14) {
          continue;
        }

        const rightAlpha = pixels[pixelIndex + 4 + 3] ?? 255;
        const leftAlpha = pixels[pixelIndex - 4 + 3] ?? 255;
        const downAlpha = pixels[pixelIndex + width * 4 + 3] ?? 255;
        const upAlpha = pixels[pixelIndex - width * 4 + 3] ?? 255;
        if (rightAlpha === 0 || leftAlpha === 0 || downAlpha === 0 || upAlpha === 0) {
          pixels[pixelIndex + 3] = 0;
        }
      }
    }
  }

  context.putImageData(imageData, 0, 0);
  return processingCanvas.toDataURL("image/png");
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for background removal."));
    image.src = source;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string" || !value.startsWith("data:image/")) {
        reject(new Error("Image upload failed."));
        return;
      }
      resolve(value);
    };
    reader.onerror = () => reject(new Error("Image upload failed."));
    reader.readAsDataURL(file);
  });
}

async function compactPreviewDataUrlForSession(sourceDataUrl: string) {
  if (!sourceDataUrl.startsWith("data:image/")) {
    return sourceDataUrl;
  }

  try {
    const image = await loadImageElement(sourceDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      return sourceDataUrl;
    }

    const scale = Math.min(1, SESSION_PREVIEW_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return sourceDataUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    const compacted = canvas.toDataURL("image/webp", SESSION_PREVIEW_WEBP_QUALITY);
    if (!compacted.startsWith("data:image/")) {
      return sourceDataUrl;
    }

    return compacted.length < sourceDataUrl.length ? compacted : sourceDataUrl;
  } catch {
    return sourceDataUrl;
  }
}

const FLOW_STEPS = [
  { number: 1, label: "Item" },
  { number: 2, label: "Color" },
  { number: 3, label: "Text" },
  { number: 4, label: "Image" },
  { number: 5, label: "Paint" },
  { number: 6, label: "Preview" },
  { number: 7, label: "Checkout" },
] as const;
const STEP_GUIDANCE_STEPS = [3, 4, 5] as const;
const STEP_GUIDANCE_MESSAGE =
  "Design the sleeves as well if you want and contact us if you want the edits on the front and back as it is or on the sides.";
const STEP_GUIDANCE_STORAGE_KEY_PREFIX = "cc-step-guidance-shown";

const FLOW_BUTTON_WHITE_CLASS = "!border-[#000000] !bg-[#ffffff] !text-[#000000] hover:!border-[#000000] hover:!bg-[#000000] hover:!text-[#ffffff] active:!border-[#000000] active:!bg-[#000000] active:!text-[#ffffff] disabled:!border-[#000000]/20 disabled:!bg-[#ffffff] disabled:!text-[#000000]/45 disabled:hover:!border-[#000000]/20 disabled:hover:!bg-[#ffffff] disabled:hover:!text-[#000000]/45";
const FLOW_BUTTON_FILLED_CLASS = "!border-[#000000] !bg-[#000000] !text-[#ffffff] hover:!border-[#000000] hover:!bg-[#000000] hover:!text-[#ffffff] active:!border-[#000000] active:!bg-[#000000] active:!text-[#ffffff]";
const FLOW_STEP_PENDING_CLASS = "border-[#000000] bg-[#ffffff] text-[#000000] hover:border-[#000000] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#000000] active:bg-[#000000] active:text-[#ffffff]";
const FLOW_STEP_COMPLETED_CLASS = "border-[#000000] bg-[#000000] text-[#ffffff]";
const SESSION_PREVIEW_MAX_EDGE = 768;
const SESSION_PREVIEW_WEBP_QUALITY = 0.75;
const COMPOSED_PREVIEW_DATA_URL_MARKER = ";cc-composed=1";
const FONT_OPTIONS = [
  "Calibri",
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Courier New",
  "Space Grotesk",
  "Helvetica",
  "Helvetica Neue",
  "Palatino Linotype",
  "Book Antiqua",
  "Cambria",
  "Candara",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Gill Sans",
  "Optima",
  "Segoe UI",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Merriweather",
  "Playfair Display",
  "Bebas Neue",
  "Futura",
  "Avenir",
  "Impact",
  "Comic Sans MS",
  "Brush Script MT",
] as const;
const IMAGE_BACKGROUND_REMOVAL_THRESHOLD = 96;
const SIZE_CHART_ORDER = ["S", "M", "L", "XL"] as const;
const SIZE_CHART_INCHES: Record<string, SizeChartMeasurements> = {
  S: { chest: 38, shoulders: 17, sleeveWidth: 7.25, sleeveLength: 8.5 },
  M: { chest: 40, shoulders: 17.75, sleeveWidth: 7.5, sleeveLength: 9 },
  L: { chest: 42, shoulders: 18.5, sleeveWidth: 7.75, sleeveLength: 9.5 },
  XL: { chest: 44, shoulders: 19.25, sleeveWidth: 8, sleeveLength: 10 },
};

function formatSizeChartValue(valueInInches: number, unit: SizeChartUnit) {
  const value = unit === "cm" ? valueInInches * 2.54 : valueInInches;
  const decimalPlaces = unit === "cm" ? 1 : 2;
  return value
    .toFixed(decimalPlaces)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function markComposedPreviewDataUrl(source: string) {
  if (!source.startsWith("data:image/")) {
    return source;
  }

  if (source.toLowerCase().includes(`${COMPOSED_PREVIEW_DATA_URL_MARKER};`)) {
    return source;
  }

  const markerIndex = source.indexOf(";base64,");
  if (markerIndex < 0) {
    return source;
  }

  return `${source.slice(0, markerIndex)}${COMPOSED_PREVIEW_DATA_URL_MARKER}${source.slice(markerIndex)}`;
}

function isStepGuidanceStep(step: number): step is (typeof STEP_GUIDANCE_STEPS)[number] {
  return STEP_GUIDANCE_STEPS.includes(step as (typeof STEP_GUIDANCE_STEPS)[number]);
}

function getStepGuidanceStorageKey(step: (typeof STEP_GUIDANCE_STEPS)[number]) {
  return `${STEP_GUIDANCE_STORAGE_KEY_PREFIX}-${step}`;
}

export function ProductCustomizer({
  product,
  initialDraftId,
  initialSessionId,
  initialAreas,
  initialStep = 2,
}: ProductCustomizerProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { openAuthModal } = useAuthModal();
  const canSaveToAccount = sessionStatus === "authenticated" && session?.user.role === "CUSTOMER";

  const normalizedInitialAreas = useMemo(() => normalizeSelectedAreas(initialAreas), [initialAreas]);
  const initialArea = normalizedInitialAreas[0] ?? "front";
  const initialFlowStep = initialStep && initialStep >= 2 && initialStep <= 5 ? initialStep : 2;

  const colors = useMemo(
    () =>
      Array.from(
        new Map(product.variants.map((variant) => [variant.colorCode, { code: variant.colorCode, name: variant.colorName }])).values(),
      ),
    [product.variants],
  );

  const [selectedColor, setSelectedColor] = useState(colors[0]?.code ?? "");

  const sizesForColor = useMemo(
    () =>
      Array.from(
        new Set(product.variants.filter((variant) => variant.colorCode === selectedColor).map((variant) => variant.sizeCode)),
      ),
    [product.variants, selectedColor],
  );

  const [currentStep, setCurrentStep] = useState(initialFlowStep);
  const [showStepGuidancePopup, setShowStepGuidancePopup] = useState(false);
  const [showSizeChartPopup, setShowSizeChartPopup] = useState(false);
  const [sizeChartUnit, setSizeChartUnit] = useState<SizeChartUnit>("in");
  const [selectedSize, setSelectedSize] = useState(sizesForColor[0] ?? "M");
  const [activeArea, setActiveArea] = useState<AreaKey>(initialArea);
  const [selectedAreas, setSelectedAreas] = useState<AreaKey[]>(normalizedInitialAreas);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Not saved yet");
  const [warningText, setWarningText] = useState<string[]>([]);
  const [isRestoringDraft, setIsRestoringDraft] = useState(Boolean(initialDraftId));
  const [isRestoringSession, setIsRestoringSession] = useState(Boolean(initialSessionId && !initialDraftId));
  const [pendingRestoreArea, setPendingRestoreArea] = useState<AreaKey | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const [tool, setTool] = useState<"select" | "draw" | "eraser">("select");
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushWidth, setBrushWidth] = useState(5);
  const [isPanMode, setIsPanMode] = useState(false);

  const [textValue, setTextValue] = useState("Your text");
  const [textSize, setTextSize] = useState(42);
  const [textColor, setTextColor] = useState("#000000");
  const [textFontFamily, setTextFontFamily] = useState<(typeof FONT_OPTIONS)[number] | string>("Calibri");
  const [textWeight, setTextWeight] = useState<"normal" | "bold">("bold");
  const [textStyle, setTextStyle] = useState<"normal" | "italic">("normal");
  const [textUnderline, setTextUnderline] = useState(false);
  const [textUnderlineColor, setTextUnderlineColor] = useState("#000000");
  const [textBackgroundEnabled, setTextBackgroundEnabled] = useState(false);
  const [textBackgroundColor, setTextBackgroundColor] = useState("#ffffff");
  const [textRotation, setTextRotation] = useState(0);
  const [textFlipMode, setTextFlipMode] = useState<"none" | "left_to_right" | "upside_down" | "both">("none");
  const [imageBackgroundEnabled, setImageBackgroundEnabled] = useState(false);
  const [imageBackgroundColor, setImageBackgroundColor] = useState("#ffffff");
  const [imageRotation, setImageRotation] = useState(0);

  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => product.variants.find((variant) => variant.colorCode === selectedColor && variant.sizeCode === selectedSize),
    [product.variants, selectedColor, selectedSize],
  );
  const sizeChartSizes = useMemo(() => {
    const availableSizes = Array.from(new Set(product.variants.map((variant) => variant.sizeCode)));
    const rankBySize: Record<string, number> = SIZE_CHART_ORDER.reduce<Record<string, number>>((acc, size, index) => {
      acc[size] = index;
      return acc;
    }, {});

    const orderedSizes = availableSizes
      .filter((size) => Boolean(SIZE_CHART_INCHES[size]))
      .sort((left, right) => {
        const leftRank = rankBySize[left] ?? Number.MAX_SAFE_INTEGER;
        const rightRank = rankBySize[right] ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return left.localeCompare(right);
      });

    return orderedSizes.length > 0
      ? orderedSizes
      : SIZE_CHART_ORDER.filter((size) => Boolean(SIZE_CHART_INCHES[size]));
  }, [product.variants]);

  const selectedPrintAreas = useMemo(
    () => product.printAreas.filter((area) => selectedAreas.includes(area.code)),
    [product.printAreas, selectedAreas],
  );
  const step2FrontImageSrc = useMemo(
    () => getCanvasClothingImageSrc(product.slug, "front") ?? getClothingImageSrc(product.slug),
    [product.slug],
  );

  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<import("fabric").Canvas | null>(null);
  const fabricRef = useRef<FabricModule | null>(null);
  const areaStatesRef = useRef<Record<AreaKey, AreaState>>(defaultAreaStateRecord());
  const historyRef = useRef<Record<AreaKey, HistoryStack>>(defaultHistoryRecord());
  const applyingStateRef = useRef(false);
  const activeAreaRef = useRef<AreaKey>(initialArea);
  const canvasZoomRef = useRef(1);
  const canvasPanRef = useRef({ x: 0, y: 0 });
  const isPanModeRef = useRef(false);
  const toolRef = useRef<"select" | "draw" | "eraser">("select");
  const isDraggingPanRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextDraftCreationRef = useRef(false);
  const restoredSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sizesForColor.includes(selectedSize)) {
      setSelectedSize(sizesForColor[0] ?? "M");
    }
  }, [sizesForColor, selectedSize]);

  useEffect(() => {
    isPanModeRef.current = isPanMode;
  }, [isPanMode]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    if (!isStepGuidanceStep(currentStep)) {
      setShowStepGuidancePopup(false);
      return;
    }

    try {
      const hasSeenPopup = window.localStorage.getItem(getStepGuidanceStorageKey(currentStep)) === "1";
      setShowStepGuidancePopup(!hasSeenPopup);
    } catch {
      setShowStepGuidancePopup(true);
    }
  }, [currentStep]);

  const clampCanvasPan = useCallback((zoom: number, x: number, y: number) => {
    if (zoom <= 1) {
      return { x: 0, y: 0 };
    }

    const minOffset = CANVAS_SIZE - CANVAS_SIZE * zoom;
    return {
      x: Math.min(0, Math.max(minOffset, x)),
      y: Math.min(0, Math.max(minOffset, y)),
    };
  }, []);

  const setCanvasView = useCallback((zoom: number, x: number, y: number) => {
    const clampedZoom = clampCanvasZoom(zoom);
    const clampedPan = clampCanvasPan(clampedZoom, x, y);

    canvasZoomRef.current = clampedZoom;
    canvasPanRef.current = clampedPan;

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.setViewportTransform([clampedZoom, 0, 0, clampedZoom, clampedPan.x, clampedPan.y]);
    canvas.requestRenderAll();
  }, [clampCanvasPan]);

  const setCanvasZoomLevel = useCallback(
    (value: number, options?: { point?: { x: number; y: number }; resetPan?: boolean }) => {
      const nextZoom = clampCanvasZoom(value);

      if (options?.resetPan) {
        setCanvasView(nextZoom, 0, 0);
        return;
      }

      const currentZoom = canvasZoomRef.current;
      const currentPan = canvasPanRef.current;
      const zoomPoint = options?.point ?? { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };

      const worldX = (zoomPoint.x - currentPan.x) / currentZoom;
      const worldY = (zoomPoint.y - currentPan.y) / currentZoom;
      const nextPanX = zoomPoint.x - worldX * nextZoom;
      const nextPanY = zoomPoint.y - worldY * nextZoom;

      setCanvasView(nextZoom, nextPanX, nextPanY);
    },
    [setCanvasView],
  );

  const getCanvasJson = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return "{}";
    }
    const payload = (
      canvas as unknown as { toJSON: (propertiesToInclude?: string[]) => unknown }
    ).toJSON(["name", "__originalUploadSrc", "__backgroundRemoved"]) as { objects?: Array<{ name?: string }> };
    if (Array.isArray(payload.objects)) {
      payload.objects = payload.objects.filter((item) => item.name !== GARMENT_LAYER_NAME);
    }
    return JSON.stringify(payload);
  }, []);

  const capturePreview = useCallback((layer?: LayerPreviewType) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return "";
    }

    const originalTransform = canvas.viewportTransform
      ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
      : null;
    const originalBackgroundColor = canvas.backgroundColor;
    const objects = canvas.getObjects();
    const originalVisibility = objects.map((object) => ({ object, visible: object.visible !== false }));

    try {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      objects.forEach((object) => {
        const objectLayer = getLayerPreviewTypeFromCanvasObject(object);
        if (!objectLayer) {
          object.visible = false;
          return;
        }
        object.visible = layer ? objectLayer === layer : true;
      });
      canvas.backgroundColor = layer ? "#ffffff" : "";
      canvas.requestRenderAll();

      return canvas.toDataURL({
        format: "png",
        multiplier: 2,
        quality: 1,
      });
    } finally {
      originalVisibility.forEach(({ object, visible }) => {
        object.visible = visible;
      });
      canvas.backgroundColor = originalBackgroundColor;
      if (originalTransform) {
        canvas.setViewportTransform(originalTransform);
      }
      canvas.requestRenderAll();
    }
  }, []);

  const captureComposedPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return "";
    }

    const originalTransform = canvas.viewportTransform
      ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
      : null;
    const originalBackgroundColor = canvas.backgroundColor;
    const objects = canvas.getObjects();
    const originalVisibility = objects.map((object) => ({ object, visible: object.visible !== false }));

    try {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      objects.forEach((object) => {
        if (getObjectName(object) === GARMENT_LAYER_NAME) {
          object.visible = true;
          return;
        }
        object.visible = object.visible !== false;
      });
      canvas.backgroundColor = "";
      canvas.requestRenderAll();

      return markComposedPreviewDataUrl(
        canvas.toDataURL({
          format: "png",
          multiplier: 2,
          quality: 1,
        }),
      );
    } finally {
      originalVisibility.forEach(({ object, visible }) => {
        object.visible = visible;
      });
      canvas.backgroundColor = originalBackgroundColor;
      if (originalTransform) {
        canvas.setViewportTransform(originalTransform);
      }
      canvas.requestRenderAll();
    }
  }, []);

  const captureLayerPreviewDataUrls = useCallback((): AreaLayerPreviewMap => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return {};
    }

    const layerObjectCounts: Record<LayerPreviewType, number> = {
      text: 0,
      upload: 0,
      edit: 0,
    };

    canvas.getObjects().forEach((object) => {
      const layer = getLayerPreviewTypeFromCanvasObject(object);
      if (!layer) {
        return;
      }
      layerObjectCounts[layer] += 1;
    });

    const output: AreaLayerPreviewMap = {};
    (["text", "upload", "edit"] as const).forEach((layer) => {
      if (layerObjectCounts[layer] <= 0) {
        return;
      }
      const preview = capturePreview(layer);
      if (preview.length > 0) {
        output[layer] = preview;
      }
    });
    return output;
  }, [capturePreview]);

  const pushHistory = useCallback((area: AreaKey) => {
    if (applyingStateRef.current) {
      return;
    }

    const snapshot = getCanvasJson();
    const history = historyRef.current[area];
    if (history.undo[history.undo.length - 1] === snapshot) {
      return;
    }

    history.undo.push(snapshot);
    if (history.undo.length > 40) {
      history.undo.shift();
    }
    history.redo = [];
  }, [getCanvasJson]);

  const persistCurrentAreaState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const area = activeAreaRef.current;
    const previousState = areaStatesRef.current[area];
    const areaHistory = historyRef.current[area];
    const hasAreaEdits = areaHistory.undo.length > 1 || areaHistory.redo.length > 0;
    const shouldKeepExistingComposedPreview =
      typeof previousState.previewDataUrl === "string"
      && previousState.previewDataUrl.length > 0
      && isComposedPreviewSource(previousState.previewDataUrl)
      && !hasAreaEdits;
    const json = getCanvasJson();

    if (shouldKeepExistingComposedPreview) {
      areaStatesRef.current[area] = {
        json,
        previewDataUrl: previousState.previewDataUrl,
        layerPreviewDataUrls: previousState.layerPreviewDataUrls,
      };
      return;
    }

    const layerPreviewDataUrls = captureLayerPreviewDataUrls();
    areaStatesRef.current[area] = {
      json,
      previewDataUrl: capturePreview(),
      layerPreviewDataUrls: Object.keys(layerPreviewDataUrls).length > 0 ? layerPreviewDataUrls : undefined,
    };
  }, [captureLayerPreviewDataUrls, capturePreview, getCanvasJson]);

  const applyToolSettings = useCallback(() => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) {
      return;
    }

    if (isPanModeRef.current) {
      canvas.isDrawingMode = false;
      return;
    }

    if (tool === "select") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      return;
    }

    if (tool === "eraser") {
      canvas.isDrawingMode = false;
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
      return;
    }

    canvas.isDrawingMode = true;
    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }

    canvas.freeDrawingBrush.color = brushColor;
    canvas.freeDrawingBrush.width = brushWidth;
    canvas.defaultCursor = "crosshair";
    canvas.hoverCursor = "crosshair";
  }, [tool, brushColor, brushWidth]);

  const applyGarmentBackdrop = useCallback(async () => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) {
      return;
    }

    const existing = canvas
      .getObjects()
      .find((object) => (object as { name?: string }).name === GARMENT_LAYER_NAME);
    if (existing) {
      canvas.remove(existing);
    }

    const source = getCanvasClothingImageSrc(product.slug, activeAreaRef.current);
    if (!source) {
      canvas.renderAll();
      return;
    }

    const backdrop = await fabric.FabricImage.fromURL(source);
    const availableSize = CANVAS_SIZE - CANVAS_PADDING * 2;
    fitImageWithinCanvas(backdrop, availableSize, availableSize);
    backdrop.set({
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hoverCursor: "default",
      moveCursor: "default",
      objectCaching: false,
    });
    (backdrop as { name?: string }).name = GARMENT_LAYER_NAME;

    canvas.add(backdrop);
    canvas.sendObjectToBack(backdrop);
    canvas.renderAll();
  }, [product.slug]);

  const validateObjects = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return [];
    }

    const warnings: string[] = [];
    canvas.getObjects().forEach((object) => {
      if (getObjectName(object) === GARMENT_LAYER_NAME) {
        return;
      }
      const bounds = object.getBoundingRect();
      if (bounds.left < 0 || bounds.top < 0 || bounds.left + bounds.width > CANVAS_SIZE || bounds.top + bounds.height > CANVAS_SIZE) {
        warnings.push("Some elements exceed the printable area boundaries.");
      }
    });

    return Array.from(new Set(warnings));
  }, []);

  const loadArea = useCallback(async (area: AreaKey) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const state = areaStatesRef.current[area];
    applyingStateRef.current = true;

    canvas.clear();
    canvas.backgroundColor = "#ffffff";

    if (state.json) {
      await canvas.loadFromJSON(state.json);
    } else {
      historyRef.current[area].undo = [JSON.stringify({ objects: [] })];
      historyRef.current[area].redo = [];
    }

    await applyGarmentBackdrop();
    setCanvasZoomLevel(canvasZoomRef.current);
    applyingStateRef.current = false;
    pushHistory(area);
  }, [applyGarmentBackdrop, pushHistory, setCanvasZoomLevel]);

  const ensureDraftExists = useCallback(async () => {
    if (draftId) {
      return draftId;
    }

    if (!selectedVariant) {
      throw new Error("Select a color and size before saving.");
    }

    const response = await fetch("/api/designs/draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: getOrCreateDesignSessionId(),
        productVariantId: selectedVariant.id,
      }),
    });

    const data = await readResponseJson<{ draftId: string }>(response);
    if (!response.ok) {
      throw new Error(responseErrorMessage(data, "Failed to create draft."));
    }

    if (typeof data.draftId !== "string" || data.draftId.length === 0) {
      throw new Error("Failed to create draft.");
    }

    setDraftId(data.draftId);
    return data.draftId;
  }, [draftId, selectedVariant]);

  const saveDraft = useCallback(
    async (options: SaveDraftOptions = {}) => {
      const manual = options.manual === true;
      const saveToAccount = options.saveToAccount === true;
      if (!saveToAccount) {
        return;
      }

      persistCurrentAreaState();
      const payloadJsonByArea = Object.fromEntries(
        AREA_KEYS.map((area) => [area, areaStatesRef.current[area].json ? JSON.parse(areaStatesRef.current[area].json as string) : {}]),
      );
      const payloadPreviewByArea = Object.fromEntries(
        AREA_KEYS.filter((area) => Boolean(areaStatesRef.current[area].previewDataUrl)).map((area) => [area, areaStatesRef.current[area].previewDataUrl]),
      );
      const payloadLayerPreviewEntries = await Promise.all(
        AREA_KEYS.map(async (area) => {
          const byLayer = areaStatesRef.current[area].layerPreviewDataUrls;
          if (!byLayer) {
            return null;
          }

          const compactedLayerEntries = await Promise.all(
            (["text", "upload", "edit"] as const)
              .filter((layer) => typeof byLayer[layer] === "string" && (byLayer[layer] as string).length > 0)
              .map(async (layer) => [layer, await compactPreviewDataUrlForSession(byLayer[layer] as string)] as const),
          );
          if (compactedLayerEntries.length === 0) {
            return null;
          }
          return [area, Object.fromEntries(compactedLayerEntries)] as const;
        }),
      );
      const payloadLayerPreviewByArea = Object.fromEntries(
        payloadLayerPreviewEntries.filter((entry): entry is readonly [AreaKey, Record<string, string>] => entry !== null),
      );

      const warnings = validateObjects();
      setWarningText(warnings);

      if (manual) {
        setIsSaving(true);
      }

      try {
        const ensuredDraftId = await ensureDraftExists();
        const response = await fetch(`/api/designs/draft/${ensuredDraftId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            designJsonByArea: payloadJsonByArea,
            previewImageUrls: payloadPreviewByArea,
            layerPreviewImageUrls: payloadLayerPreviewByArea,
            saveToAccount: true,
          }),
        });

        const data = await readResponseJson<{ savedAt: string }>(response);
        if (!response.ok) {
          throw new Error(responseErrorMessage(data, "Failed to save draft."));
        }

        if (typeof data.savedAt !== "string") {
          throw new Error("Failed to save draft.");
        }

        setSaveLabel(`Saved to account at ${formatTimeIst(data.savedAt)}`);
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to save draft.");
      } finally {
        setIsSaving(false);
      }
    },
    [ensureDraftExists, persistCurrentAreaState, validateObjects],
  );

  useEffect(() => {
    if (!canvasElementRef.current || canvasRef.current) {
      return;
    }

    let disposed = false;

    (async () => {
      const fabric = await import("fabric");
      if (disposed || !canvasElementRef.current) {
        return;
      }

      const fabricObjectCtor = fabric.FabricObject as unknown as { customProperties?: string[] };
      fabricObjectCtor.customProperties = Array.from(new Set([
        ...(fabricObjectCtor.customProperties ?? []),
        "name",
        "__originalUploadSrc",
        "__backgroundRemoved",
      ]));

      const textPrototype = (
        fabric.FabricText as unknown as {
          prototype: {
            _renderTextDecoration?: (ctx: CanvasRenderingContext2D, type: "underline" | "linethrough" | "overline") => void;
            getValueOfPropertyAt?: (lineIndex: number, charIndex: number, property: string) => unknown;
            __customUnderlineColorPatched?: boolean;
            stroke?: unknown;
          };
        }
      ).prototype;
      if (textPrototype && !textPrototype.__customUnderlineColorPatched && typeof textPrototype._renderTextDecoration === "function") {
        const originalRenderTextDecoration = textPrototype._renderTextDecoration;
        textPrototype._renderTextDecoration = function (
          this: {
            stroke?: unknown;
            getValueOfPropertyAt?: (lineIndex: number, charIndex: number, property: string) => unknown;
          },
          ctx: CanvasRenderingContext2D,
          type: "underline" | "linethrough" | "overline",
        ) {
          if (type !== "underline") {
            originalRenderTextDecoration.call(this, ctx, type);
            return;
          }

          const underlineColor = typeof this.stroke === "string" && this.stroke.trim().length > 0
            ? this.stroke.trim()
            : null;
          if (!underlineColor || typeof this.getValueOfPropertyAt !== "function") {
            originalRenderTextDecoration.call(this, ctx, type);
            return;
          }

          const originalGetValue = this.getValueOfPropertyAt;
          this.getValueOfPropertyAt = function (
            lineIndex: number,
            charIndex: number,
            property: string,
          ) {
            if (property === "fill") {
              return underlineColor;
            }
            return originalGetValue.call(this, lineIndex, charIndex, property);
          };
          try {
            originalRenderTextDecoration.call(this, ctx, type);
          } finally {
            this.getValueOfPropertyAt = originalGetValue;
          }
        };
        textPrototype.__customUnderlineColorPatched = true;
      }

      fabricRef.current = fabric;
      const canvas = new fabric.Canvas(canvasElementRef.current, {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });

      canvasRef.current = canvas;
      setIsCanvasReady(true);

      const onMutate = (event: unknown) => {
        if (applyingStateRef.current) {
          return;
        }

        if (event && typeof event === "object") {
          const eventName = (event as { type?: unknown }).type;
          const target = (event as { target?: unknown }).target;
          const targetType = target && typeof target === "object"
            ? (target as { type?: unknown }).type
            : undefined;

          if (
            eventName === "object:added"
            && target
            && targetType === "path"
            && (toolRef.current === "draw" || toolRef.current === "eraser")
          ) {
            (target as { name?: string }).name = STEP5_EDIT_OBJECT_NAME;
          }
        }

        const objectName =
          event && typeof event === "object"
            ? getObjectName((event as { target?: unknown }).target) ??
              getObjectName((event as { path?: unknown }).path)
            : undefined;

        if (objectName === GARMENT_LAYER_NAME) {
          return;
        }
        setSaveLabel("Unsaved changes");
        pushHistory(activeAreaRef.current);
      };

      const keepBackdropFixed = (event: unknown) => {
        if (!event || typeof event !== "object") {
          return;
        }

        const target = (event as { target?: { set?: (options: Record<string, unknown>) => unknown; setCoords?: () => void } }).target;
        if (!target || getObjectName(target) !== GARMENT_LAYER_NAME) {
          return;
        }

        target.set?.({
          left: CANVAS_SIZE / 2,
          top: CANVAS_SIZE / 2,
          originX: "center",
          originY: "center",
        });
        target.setCoords?.();
        canvas.discardActiveObject();
        canvas.sendObjectToBack(target as unknown as import("fabric").FabricObject);
        canvas.requestRenderAll();
      };

      const resolveEventPoint = (event: unknown, native: MouseEvent | WheelEvent) => {
        const point = event && typeof event === "object"
          ? (event as { viewportPoint?: { x?: number; y?: number } }).viewportPoint
          : undefined;

        if (point && typeof point.x === "number" && typeof point.y === "number") {
          return { x: point.x, y: point.y };
        }

        const bounds = canvas.upperCanvasEl.getBoundingClientRect();
        const scaleX = CANVAS_SIZE / bounds.width;
        const scaleY = CANVAS_SIZE / bounds.height;
        return {
          x: (native.clientX - bounds.left) * scaleX,
          y: (native.clientY - bounds.top) * scaleY,
        };
      };

      const onCanvasWheel = (event: unknown) => {
        if (!event || typeof event !== "object") {
          return;
        }

        const native = (event as { e?: WheelEvent }).e;
        if (!native) {
          return;
        }

        native.preventDefault();
        native.stopPropagation();

        const deltaFactor = native.deltaY > 0 ? 0.9 : 1.06;
        const zoomPoint = resolveEventPoint(event, native);
        setCanvasZoomLevel(canvasZoomRef.current * deltaFactor, { point: zoomPoint });
      };

      const onCanvasMouseDown = (event: unknown) => {
        if (!isPanModeRef.current || !event || typeof event !== "object") {
          return;
        }

        const native = (event as { e?: MouseEvent }).e;
        if (!native || native.button !== 0) {
          return;
        }

        native.preventDefault();
        native.stopPropagation();

        isDraggingPanRef.current = true;
        lastPanPointRef.current = resolveEventPoint(event, native);
        canvas.discardActiveObject();
        canvas.defaultCursor = "grabbing";
        canvas.hoverCursor = "grabbing";
        canvas.requestRenderAll();
      };

      const onCanvasMouseMove = (event: unknown) => {
        if (!isPanModeRef.current || !isDraggingPanRef.current || !event || typeof event !== "object") {
          return;
        }

        const native = (event as { e?: MouseEvent }).e;
        if (!native) {
          return;
        }

        native.preventDefault();
        native.stopPropagation();

        const currentPoint = resolveEventPoint(event, native);
        const previousPoint = lastPanPointRef.current;
        if (!previousPoint) {
          lastPanPointRef.current = currentPoint;
          return;
        }

        const deltaX = currentPoint.x - previousPoint.x;
        const deltaY = currentPoint.y - previousPoint.y;
        setCanvasView(
          canvasZoomRef.current,
          canvasPanRef.current.x + deltaX,
          canvasPanRef.current.y + deltaY,
        );
        lastPanPointRef.current = currentPoint;
      };

      const onCanvasMouseUp = () => {
        if (!isDraggingPanRef.current) {
          return;
        }

        isDraggingPanRef.current = false;
        lastPanPointRef.current = null;
        canvas.defaultCursor = "grab";
        canvas.hoverCursor = "grab";
      };

      const syncControlsFromActiveObject = (event?: unknown) => {
        const target = event && typeof event === "object"
          ? (event as { target?: unknown }).target
          : undefined;
        if (target) {
          syncTextControlsFromObject(target);
          syncImageControlsFromObject(target);
          return;
        }

        const activeObject = canvas.getActiveObject();
        syncTextControlsFromObject(activeObject);
        syncImageControlsFromObject(activeObject);
      };

      canvas.on("object:added", onMutate);
      canvas.on("object:modified", onMutate);
      canvas.on("object:removed", onMutate);
      canvas.on("path:created", onMutate);
      canvas.on("text:changed", onMutate);
      canvas.on("selection:created", syncControlsFromActiveObject);
      canvas.on("selection:updated", syncControlsFromActiveObject);
      canvas.on("text:changed", syncControlsFromActiveObject);
      canvas.on("object:modified", syncControlsFromActiveObject);
      canvas.on("object:moving", keepBackdropFixed);
      canvas.on("object:scaling", keepBackdropFixed);
      canvas.on("object:rotating", keepBackdropFixed);
      canvas.on("mouse:wheel", onCanvasWheel);
      canvas.on("mouse:down", onCanvasMouseDown);
      canvas.on("mouse:move", onCanvasMouseMove);
      canvas.on("mouse:up", onCanvasMouseUp);

      await applyGarmentBackdrop();
      setCanvasZoomLevel(canvasZoomRef.current);
      pushHistory(activeAreaRef.current);
    })();

    return () => {
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
      setIsCanvasReady(false);
    };
  }, [applyGarmentBackdrop, pushHistory, setCanvasView, setCanvasZoomLevel]);

  useEffect(() => {
    applyToolSettings();
  }, [applyToolSettings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (isPanMode) {
      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.skipTargetFind = true;
      canvas.defaultCursor = "grab";
      canvas.hoverCursor = "grab";
      canvas.isDrawingMode = false;
    } else {
      isDraggingPanRef.current = false;
      lastPanPointRef.current = null;
      canvas.selection = true;
      canvas.skipTargetFind = false;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      applyToolSettings();
    }

    canvas.requestRenderAll();
  }, [isPanMode, applyToolSettings]);

  useEffect(() => {
    if (!initialSessionId || initialDraftId) {
      setIsRestoringSession(false);
      return;
    }

    if (restoredSessionIdRef.current === initialSessionId) {
      return;
    }
    restoredSessionIdRef.current = initialSessionId;

    let cancelled = false;

    (async () => {
      setBusyMessage("Restoring current design...");
      setIsRestoringSession(true);
      try {
        const sessionSnapshot = readPreviewSession(initialSessionId);
        if (!sessionSnapshot || sessionSnapshot.productSlug !== product.slug) {
          throw new Error("Unable to restore your unsaved design. Please continue from Step 2.");
        }

        skipNextDraftCreationRef.current = true;
        if (sessionSnapshot.selectedColor.length > 0) {
          setSelectedColor(sessionSnapshot.selectedColor);
        }
        if (sessionSnapshot.selectedSize.length > 0) {
          setSelectedSize(sessionSnapshot.selectedSize);
        }

        let fallbackDraft: ExistingDraftPayload | null = null;
        const shouldAttemptDraftBackfill = Boolean(sessionSnapshot.sourceDraftId)
          && (
            !AREA_KEYS.some((area) => hasAreaSnapshotData(sessionSnapshot.designJsonByArea[area]))
            || sessionSnapshot.selectedAreas.some((area) => !hasAreaSnapshotData(sessionSnapshot.designJsonByArea[area]))
          );

        if (shouldAttemptDraftBackfill && sessionSnapshot.sourceDraftId) {
          const draftResponse = await fetch(`/api/designs/draft/${sessionSnapshot.sourceDraftId}`);
          const draftData = await readResponseJson<{ draft: ExistingDraftPayload }>(draftResponse);
          if (draftResponse.ok && draftData.draft) {
            fallbackDraft = draftData.draft;
          }
        }

        areaStatesRef.current = defaultAreaStateRecord();
        historyRef.current = defaultHistoryRecord();

        const fallbackDesignByArea = fallbackDraft?.designJsonByArea ?? {};
        const fallbackPreviewByArea = fallbackDraft?.previewImageUrls ?? {};
        const fallbackLayerPreviewByArea = fallbackDraft?.layerPreviewImageUrls ?? {};

        AREA_KEYS.forEach((area) => {
          const designState = hasAreaSnapshotData(sessionSnapshot.designJsonByArea[area])
            ? sessionSnapshot.designJsonByArea[area]
            : fallbackDesignByArea[area];
          if (designState && typeof designState === "object") {
            areaStatesRef.current[area].json = JSON.stringify(designState);
          }

          const previewImage = sessionSnapshot.previewImageUrls[area] ?? fallbackPreviewByArea[area];
          if (typeof previewImage === "string" && previewImage.length > 0) {
            areaStatesRef.current[area].previewDataUrl = previewImage;
          }

          const layerPreviewByType = sessionSnapshot.layerPreviewImageUrls[area] ?? fallbackLayerPreviewByArea[area];
          if (layerPreviewByType && typeof layerPreviewByType === "object") {
            const parsedLayerPreviewByType = (["text", "upload", "edit"] as const).reduce<AreaLayerPreviewMap>((acc, layer) => {
              const source = layerPreviewByType[layer];
              if (typeof source === "string" && source.length > 0) {
                acc[layer] = source;
              }
              return acc;
            }, {});
            if (Object.keys(parsedLayerPreviewByType).length > 0) {
              areaStatesRef.current[area].layerPreviewDataUrls = parsedLayerPreviewByType;
            }
          }
        });

        const restoredAreas = normalizeSelectedAreas(sessionSnapshot.selectedAreas);
        const restoredArea = restoredAreas[0] ?? "front";
        activeAreaRef.current = restoredArea;
        setActiveArea(restoredArea);
        setSelectedAreas(restoredAreas);
        setCurrentStep(initialFlowStep);
        setDraftId(sessionSnapshot.sourceDraftId ?? null);
        setSaveLabel("Not saved yet");
        setErrorMessage(null);
        setCanvasZoomLevel(1, { resetPan: true });

        if (canvasRef.current) {
          await loadArea(restoredArea);
        } else {
          setPendingRestoreArea(restoredArea);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to restore unsaved design.");
        }
      } finally {
        if (!cancelled) {
          setBusyMessage(null);
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialDraftId, initialFlowStep, initialSessionId, loadArea, product.slug, setCanvasZoomLevel]);

  useEffect(() => {
    if (!initialDraftId) {
      setIsRestoringDraft(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setBusyMessage("Loading saved draft...");
      try {
        const response = await fetch(`/api/designs/draft/${initialDraftId}`);
        const data = await readResponseJson<{ draft: ExistingDraftPayload }>(response);
        if (!response.ok || !data.draft) {
          throw new Error(responseErrorMessage(data, "Failed to load existing draft."));
        }

        const draft = data.draft;
        const variantColor = draft.productVariant?.colorCode;
        const variantSize = draft.productVariant?.sizeCode;

        if (cancelled) {
          return;
        }

        if (typeof variantColor === "string" && variantColor.length > 0) {
          setSelectedColor(variantColor);
        }

        if (typeof variantSize === "string" && variantSize.length > 0) {
          setSelectedSize(variantSize);
        }

        areaStatesRef.current = defaultAreaStateRecord();
        historyRef.current = defaultHistoryRecord();

        const designJsonByArea = draft.designJsonByArea ?? {};
        const previewByArea = draft.previewImageUrls ?? {};
        const layerPreviewByArea = draft.layerPreviewImageUrls ?? {};
        AREA_KEYS.forEach((area) => {
          const designState = designJsonByArea[area];
          if (designState && typeof designState === "object") {
            areaStatesRef.current[area].json = JSON.stringify(designState);
          }

          const previewImage = previewByArea[area];
          if (typeof previewImage === "string" && previewImage.length > 0) {
            areaStatesRef.current[area].previewDataUrl = previewImage;
          }

          const layerPreviewByType = layerPreviewByArea[area];
          if (layerPreviewByType && typeof layerPreviewByType === "object") {
            const parsedLayerPreviewByType = (["text", "upload", "edit"] as const).reduce<AreaLayerPreviewMap>((acc, layer) => {
              const source = layerPreviewByType[layer];
              if (typeof source === "string" && source.length > 0) {
                acc[layer] = source;
              }
              return acc;
            }, {});
            if (Object.keys(parsedLayerPreviewByType).length > 0) {
              areaStatesRef.current[area].layerPreviewDataUrls = parsedLayerPreviewByType;
            }
          }
        });

        const restoredArea = normalizedInitialAreas[0] ?? "front";
        activeAreaRef.current = restoredArea;
        setActiveArea(restoredArea);
        setSelectedAreas(normalizedInitialAreas);
        setCurrentStep(initialFlowStep);
        setDraftId(draft.id);
        setSaveLabel("Draft restored");
        setErrorMessage(null);
        setCanvasZoomLevel(1, { resetPan: true });
        skipNextDraftCreationRef.current = true;

        if (canvasRef.current) {
          await loadArea(restoredArea);
        } else {
          setPendingRestoreArea(restoredArea);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load existing draft.");
        }
      } finally {
        if (!cancelled) {
          setBusyMessage(null);
          setIsRestoringDraft(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialDraftId, initialFlowStep, loadArea, normalizedInitialAreas, setCanvasZoomLevel]);

  useEffect(() => {
    if (!isCanvasReady || !pendingRestoreArea) {
      return;
    }

    let cancelled = false;

    (async () => {
      await loadArea(pendingRestoreArea);
      if (!cancelled) {
        setPendingRestoreArea(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCanvasReady, loadArea, pendingRestoreArea]);

  useEffect(() => {
    if (!selectedVariant || isRestoringDraft || isRestoringSession) {
      return;
    }

    if (skipNextDraftCreationRef.current) {
      skipNextDraftCreationRef.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      setBusyMessage("Preparing design state...");
      try {
        areaStatesRef.current = defaultAreaStateRecord();
        historyRef.current = defaultHistoryRecord();
        activeAreaRef.current = "front";
        setActiveArea("front");
        setSelectedAreas(["front"]);
        setDraftId(null);
        setSaveLabel("Not saved yet");
        setErrorMessage(null);
        setCanvasZoomLevel(1, { resetPan: true });

        const canvas = canvasRef.current;
        if (canvas) {
          applyingStateRef.current = true;
          canvas.clear();
          canvas.backgroundColor = "#ffffff";
          await applyGarmentBackdrop();
          setCanvasZoomLevel(1, { resetPan: true });
          applyingStateRef.current = false;
          pushHistory("front");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to prepare design state.");
        }
      } finally {
        applyingStateRef.current = false;
        if (!cancelled) {
          setBusyMessage(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyGarmentBackdrop, isRestoringDraft, isRestoringSession, selectedVariant, pushHistory, setCanvasZoomLevel]);

  const switchArea = async (area: AreaKey) => {
    const currentArea = activeAreaRef.current;
    if (area === currentArea) {
      return;
    }

    persistCurrentAreaState();
    activeAreaRef.current = area;
    setActiveArea(area);
    await loadArea(area);
  };

  const areaSelectorOptions = useMemo<AreaSelectorOption[]>(() => {
    return AREA_KEYS.map((area) => ({
      id: area,
      area,
      label: AREA_LABELS[area],
    }));
  }, []);

  const activeAreaLabel = useMemo(() => AREA_LABELS[activeArea], [activeArea]);

  const renderAreaSelectorButtons = () => (
    <div className="space-y-2 pt-1">
      <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Design Area</p>
      <div className="flex flex-wrap gap-2">
        {areaSelectorOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              void switchArea(option.area);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              activeArea === option.area
                ? "border-[#000000] bg-[#000000] text-[#ffffff]"
                : "border-[#000000] bg-[#ffffff] text-[#000000] hover:border-[#000000] hover:bg-[#000000] hover:text-[#ffffff] active:border-[#000000] active:bg-[#000000] active:text-[#ffffff]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCanvasActionButtons = () => (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={() => setTool("select")} className={FLOW_BUTTON_WHITE_CLASS}>Select</Button>
      <Button onClick={clearArea} className={FLOW_BUTTON_WHITE_CLASS}>Remove Selected</Button>
      <Button onClick={() => void redo()} className={FLOW_BUTTON_WHITE_CLASS}>Redo</Button>
      <Button onClick={() => setIsPanMode((value) => !value)} className={isPanMode ? FLOW_BUTTON_FILLED_CLASS : FLOW_BUTTON_WHITE_CLASS}>
        {isPanMode ? "Pan: On" : "Pan: Off"}
      </Button>
    </div>
  );

  function syncTextControlsFromObject(value: unknown) {
    const textObject = asCanvasTextObject(value);
    if (!textObject) {
      return;
    }

    const renderedText = typeof textObject.text === "string" ? textObject.text : "";
    setTextValue(renderedText);

    if (typeof textObject.fontSize === "number" && Number.isFinite(textObject.fontSize)) {
      setTextSize(Math.max(10, Math.min(160, textObject.fontSize)));
    }

    if (typeof textObject.fill === "string") {
      setTextColor(normalizeHexColor(textObject.fill, "#000000"));
    }

    if (typeof textObject.fontFamily === "string" && textObject.fontFamily.trim().length > 0) {
      setTextFontFamily(textObject.fontFamily.trim());
    }

    const fontWeight = textObject.fontWeight;
    const isBold = fontWeight === "bold" || fontWeight === 700 || fontWeight === "700";
    setTextWeight(isBold ? "bold" : "normal");
    setTextStyle(textObject.fontStyle === "italic" ? "italic" : "normal");
    setTextUnderline(Boolean(textObject.underline));
    setTextUnderlineColor(
      normalizeHexColor(
        textObject.stroke,
        normalizeHexColor(textObject.fill, "#000000"),
      ),
    );
    if (typeof textObject.textBackgroundColor === "string" && textObject.textBackgroundColor.trim().length > 0) {
      setTextBackgroundEnabled(true);
      setTextBackgroundColor(normalizeHexColor(textObject.textBackgroundColor, "#ffffff"));
    } else {
      setTextBackgroundEnabled(false);
      setTextBackgroundColor("#ffffff");
    }

    const rotation = typeof textObject.angle === "number" && Number.isFinite(textObject.angle)
      ? Math.max(-360, Math.min(360, textObject.angle))
      : 0;
    setTextRotation(rotation);

    const flipX = Boolean(textObject.flipX);
    const flipY = Boolean(textObject.flipY);
    setTextFlipMode(
      flipX && flipY ? "both" : flipX ? "left_to_right" : flipY ? "upside_down" : "none",
    );
  }

  function syncImageControlsFromObject(value: unknown) {
    const imageObject = asCanvasImageObject(value);
    if (!imageObject) {
      return;
    }

    const rotation = typeof imageObject.angle === "number" && Number.isFinite(imageObject.angle)
      ? Math.max(-360, Math.min(360, imageObject.angle))
      : 0;
    setImageRotation(rotation);

    const imageBackground = typeof imageObject.backgroundColor === "string"
      ? imageObject.backgroundColor.trim()
      : "";
    if (imageBackground.length === 0) {
      setImageBackgroundEnabled(false);
      setImageBackgroundColor("#ffffff");
      return;
    }

    setImageBackgroundEnabled(true);
    setImageBackgroundColor(normalizeHexColor(imageBackground, "#ffffff"));
  }

  const applyTextControlsToActiveObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const textObject = asCanvasTextObject(canvas.getActiveObject());
    if (!textObject) {
      return;
    }

    const flipX = textFlipMode === "left_to_right" || textFlipMode === "both";
    const flipY = textFlipMode === "upside_down" || textFlipMode === "both";
    const normalizedRotation = Number.isFinite(textRotation) ? Math.max(-360, Math.min(360, textRotation)) : 0;
    const normalizedTextSize = Number.isFinite(textSize) ? Math.max(10, Math.min(160, textSize)) : 24;
    const nextRotation = Math.abs(normalizedRotation) === 360 ? 0 : normalizedRotation;
    const currentText = typeof textObject.text === "string" ? textObject.text : "";
    const currentFill = typeof textObject.fill === "string" ? textObject.fill : "";
    const currentFontFamily = typeof textObject.fontFamily === "string" ? textObject.fontFamily : "";
    const currentFontSize = typeof textObject.fontSize === "number" && Number.isFinite(textObject.fontSize)
      ? textObject.fontSize
      : 24;
    const currentFontWeight = textObject.fontWeight === "bold" || textObject.fontWeight === 700 || textObject.fontWeight === "700"
      ? "bold"
      : "normal";
    const currentFontStyle = textObject.fontStyle === "italic" ? "italic" : "normal";
    const currentUnderline = Boolean(textObject.underline);
    const currentStroke = typeof textObject.stroke === "string" ? textObject.stroke : "";
    const currentTextBackgroundColor = typeof textObject.textBackgroundColor === "string" ? textObject.textBackgroundColor : "";
    const currentFlipX = Boolean(textObject.flipX);
    const currentFlipY = Boolean(textObject.flipY);
    const currentRotation = typeof textObject.angle === "number" && Number.isFinite(textObject.angle)
      ? textObject.angle
      : 0;
    const nextTextBackgroundColor = textBackgroundEnabled ? textBackgroundColor : "";

    const hasChanges = currentText !== textValue
      || currentFill !== textColor
      || currentFontFamily !== textFontFamily
      || currentFontSize !== normalizedTextSize
      || currentFontWeight !== textWeight
      || currentFontStyle !== textStyle
      || currentUnderline !== textUnderline
      || currentStroke !== textUnderlineColor
      || currentTextBackgroundColor !== nextTextBackgroundColor
      || currentFlipX !== flipX
      || currentFlipY !== flipY
      || currentRotation !== nextRotation;

    if (!hasChanges) {
      return;
    }

    textObject.set({
      text: textValue,
      fill: textColor,
      fontFamily: textFontFamily,
      fontSize: normalizedTextSize,
      fontWeight: textWeight,
      fontStyle: textStyle,
      underline: textUnderline,
      stroke: textUnderlineColor,
      strokeWidth: 0,
      textBackgroundColor: nextTextBackgroundColor,
      flipX,
      flipY,
      angle: nextRotation,
    });
    textObject.setCoords();
    canvas.requestRenderAll();
    canvas.fire("object:modified", { target: textObject });
  }, [textValue, textFlipMode, textRotation, textSize, textColor, textFontFamily, textWeight, textStyle, textUnderline, textUnderlineColor, textBackgroundEnabled, textBackgroundColor]);

  useEffect(() => {
    applyTextControlsToActiveObject();
  }, [applyTextControlsToActiveObject]);

  const applyImageControlsToActiveObject = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const imageObject = asCanvasImageObject(canvas.getActiveObject());
    if (!imageObject) {
      return;
    }

    const nextBackgroundColor = imageBackgroundEnabled ? imageBackgroundColor : "";
    const currentBackgroundColor = typeof imageObject.backgroundColor === "string"
      ? imageObject.backgroundColor.trim()
      : "";
    const normalizedRotation = Number.isFinite(imageRotation) ? Math.max(-360, Math.min(360, imageRotation)) : 0;
    const nextRotation = Math.abs(normalizedRotation) === 360 ? 0 : normalizedRotation;
    const currentRotation = typeof imageObject.angle === "number" && Number.isFinite(imageObject.angle)
      ? imageObject.angle
      : 0;

    if (currentBackgroundColor === nextBackgroundColor && currentRotation === nextRotation) {
      return;
    }

    imageObject.set({
      backgroundColor: nextBackgroundColor,
      angle: nextRotation,
    });
    imageObject.setCoords();
    canvas.requestRenderAll();
    canvas.fire("object:modified", { target: imageObject });
  }, [imageBackgroundEnabled, imageBackgroundColor, imageRotation]);

  useEffect(() => {
    applyImageControlsToActiveObject();
  }, [applyImageControlsToActiveObject]);

  const addText = () => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) {
      return;
    }

    const baseText = textValue.trim() || "Custom text";
    const flipX = textFlipMode === "left_to_right" || textFlipMode === "both";
    const flipY = textFlipMode === "upside_down" || textFlipMode === "both";
    const rotation = Number.isFinite(textRotation) ? Math.max(-360, Math.min(360, textRotation)) : 0;

    const textbox = new fabric.Textbox(baseText, {
      left: 120,
      top: 120,
      fill: textColor,
      fontFamily: textFontFamily,
      fontSize: textSize,
      fontWeight: textWeight,
      fontStyle: textStyle,
      underline: textUnderline,
      stroke: textUnderlineColor,
      strokeWidth: 0,
      textBackgroundColor: textBackgroundEnabled ? textBackgroundColor : "",
      flipX,
      flipY,
      angle: Math.abs(rotation) === 360 ? 0 : rotation,
      width: 320,
      editable: true,
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    syncTextControlsFromObject(textbox);
    canvas.renderAll();
  };

  const addRectangle = () => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) {
      return;
    }

    const rect = new fabric.Rect({
      left: 140,
      top: 140,
      width: 180,
      height: 120,
      fill: "transparent",
      stroke: brushColor,
      strokeWidth: 3,
    });
    (rect as { name?: string }).name = STEP5_EDIT_OBJECT_NAME;

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();
  };

  const addCircle = () => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) {
      return;
    }

    const circle = new fabric.Circle({
      left: 180,
      top: 180,
      radius: 70,
      fill: "transparent",
      stroke: brushColor,
      strokeWidth: 3,
    });
    (circle as { name?: string }).name = STEP5_EDIT_OBJECT_NAME;

    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
  };

  const redo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const history = historyRef.current[activeArea];
    const next = history.redo.pop();
    if (!next) {
      return;
    }

    history.undo.push(next);
    applyingStateRef.current = true;
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    await canvas.loadFromJSON(next);
    await applyGarmentBackdrop();
    setCanvasZoomLevel(canvasZoomRef.current);
    applyingStateRef.current = false;
  };

  const onUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!file || !canvas || !fabric) {
      return;
    }

    setBusyMessage("Uploading image...");
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const image = await fabric.FabricImage.fromURL(imageDataUrl);
      const maxDesignImageSize = CANVAS_SIZE * 0.48;
      fitImageWithinCanvas(image, maxDesignImageSize, maxDesignImageSize, false);
      const normalizedImageRotation = Number.isFinite(imageRotation) ? Math.max(-360, Math.min(360, imageRotation)) : 0;
      image.set({
        backgroundColor: imageBackgroundEnabled ? imageBackgroundColor : "",
        angle: Math.abs(normalizedImageRotation) === 360 ? 0 : normalizedImageRotation,
      });
      (image as CanvasImageObject).__originalUploadSrc = imageDataUrl;
      (image as CanvasImageObject).__backgroundRemoved = false;
      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.renderAll();
      syncImageControlsFromObject(image);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setBusyMessage(null);
      event.target.value = "";
    }
  };

  const removeImageBackground = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const imageObject = asCanvasImageObject(canvas.getActiveObject());
    if (!imageObject) {
      setErrorMessage("Select an uploaded image to remove background.");
      return;
    }

    const objectSnapshot = {
      left: imageObject.left,
      top: imageObject.top,
      angle: imageObject.angle,
      scaleX: imageObject.scaleX,
      scaleY: imageObject.scaleY,
      flipX: imageObject.flipX,
      flipY: imageObject.flipY,
      originX: imageObject.originX,
      originY: imageObject.originY,
      width: imageObject.width,
      height: imageObject.height,
      cropX: imageObject.cropX,
      cropY: imageObject.cropY,
    };

    const currentSrc = imageObject.getSrc();
    if (!imageObject.__originalUploadSrc && currentSrc.length > 0) {
      imageObject.__originalUploadSrc = currentSrc;
    }

    const sourceForRemoval = imageObject.__originalUploadSrc ?? currentSrc;
    if (sourceForRemoval.length === 0) {
      setErrorMessage("Unable to remove background for this image.");
      return;
    }

    setBusyMessage("Removing image background...");
    try {
      const sourceImageElement = await loadImageElement(sourceForRemoval);
      const processedSrc = removeBackgroundFromImageElement(sourceImageElement);
      await imageObject.setSrc(processedSrc);
      imageObject.__backgroundRemoved = processedSrc !== sourceForRemoval;
      imageObject.set({
        ...objectSnapshot,
        backgroundColor: imageBackgroundEnabled ? imageBackgroundColor : "",
      });
      imageObject.setCoords();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: imageObject });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Background removal failed.");
    } finally {
      setBusyMessage(null);
    }
  };

  const clearArea = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const activeObject = canvas.getActiveObject();
    if (!activeObject) {
      setErrorMessage("Select an element to remove.");
      return;
    }

    let removedCount = 0;
    const selection = activeObject as {
      type?: unknown;
      getObjects?: () => import("fabric").FabricObject[];
    };

    if (selection.type === "activeSelection" && typeof selection.getObjects === "function") {
      selection.getObjects().forEach((object) => {
        if (getObjectName(object) === GARMENT_LAYER_NAME) {
          return;
        }
        canvas.remove(object);
        removedCount += 1;
      });
    } else if (getObjectName(activeObject) !== GARMENT_LAYER_NAME) {
      canvas.remove(activeObject);
      removedCount += 1;
    }

    if (removedCount === 0) {
      setErrorMessage("No removable element selected.");
      return;
    }

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setErrorMessage(null);
  };

  const clearAllStep5Edits = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const step5Objects = canvas.getObjects().filter((object) => isStep5EditObject(object));
    if (step5Objects.length === 0) {
      setErrorMessage("No Step 5 edits to clear.");
      return;
    }

    const shouldClear = window.confirm("Are you sure you want to delete all Step 5 edits?");
    if (!shouldClear) {
      return;
    }

    applyingStateRef.current = true;
    step5Objects.forEach((object) => {
      canvas.remove(object);
    });
    applyingStateRef.current = false;

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    pushHistory(activeArea);
    setErrorMessage(null);
  };

  const continueToPreview = async () => {
    if (!selectedVariant) {
      setErrorMessage("Select a color and size before continuing to preview.");
      return;
    }

    if (selectedPrintAreas.length === 0) {
      setErrorMessage("Select at least one print area before continuing to preview.");
      return;
    }

    setBusyMessage("Preparing preview...");
    try {
      persistCurrentAreaState();
      const payloadJsonByArea = Object.fromEntries(
        AREA_KEYS.map((area) => [area, areaStatesRef.current[area].json ? JSON.parse(areaStatesRef.current[area].json as string) : {}]),
      );
      const payloadPreviewEntries = await Promise.all(
        AREA_KEYS
          .filter((area) => Boolean(areaStatesRef.current[area].previewDataUrl))
          .map(async (area) => {
            const previewDataUrl = areaStatesRef.current[area].previewDataUrl as string;
            const compactedPreview = await compactPreviewDataUrlForSession(previewDataUrl);
            return [area, compactedPreview] as const;
          }),
      );
      const payloadPreviewByArea = Object.fromEntries(payloadPreviewEntries) as Partial<Record<AreaKey, string>>;
      const composedPreviewDataUrl = captureComposedPreview();
      if (composedPreviewDataUrl.length > 0) {
        payloadPreviewByArea[activeAreaRef.current] = await compactPreviewDataUrlForSession(composedPreviewDataUrl);
      }
      const payloadLayerPreviewEntries = await Promise.all(
        AREA_KEYS.map(async (area) => {
          const byLayer = areaStatesRef.current[area].layerPreviewDataUrls;
          if (!byLayer) {
            return null;
          }

          const compactedLayerEntries = await Promise.all(
            (["text", "upload", "edit"] as const)
              .filter((layer) => typeof byLayer[layer] === "string" && (byLayer[layer] as string).length > 0)
              .map(async (layer) => [layer, await compactPreviewDataUrlForSession(byLayer[layer] as string)] as const),
          );

          if (compactedLayerEntries.length === 0) {
            return null;
          }

          return [area, Object.fromEntries(compactedLayerEntries)] as const;
        }),
      );
      const payloadLayerPreviewByArea = Object.fromEntries(
        payloadLayerPreviewEntries.filter((entry): entry is readonly [AreaKey, Record<string, string>] => entry !== null),
      );

      const warnings = validateObjects();
      setWarningText(warnings);

      setErrorMessage(null);
      const previewSessionId = createPreviewSessionId();
      const existingInitialSession = initialSessionId && initialSessionId.length > 0
        ? readPreviewSession(initialSessionId)
        : null;
      const sourceDraftId = (() => {
        if (draftId && draftId.length > 0) {
          return draftId;
        }
        if (initialDraftId && initialDraftId.length > 0) {
          return initialDraftId;
        }
        if (existingInitialSession?.sourceDraftId && existingInitialSession.sourceDraftId.length > 0) {
          return existingInitialSession.sourceDraftId;
        }
        return undefined;
      })();
      const step6MessageFromSession = (() => {
        if (existingInitialSession?.step6Message && existingInitialSession.step6Message.trim().length > 0) {
          return existingInitialSession.step6Message.trim();
        }
        return undefined;
      })();
      const previewAreasFromCanvas = AREA_KEYS.filter((area) =>
        hasDesignObjectsInAreaJson(areaStatesRef.current[area].json),
      );
      const previewAreas = Array.from(
        new Set(
          (previewAreasFromCanvas.length > 0 ? previewAreasFromCanvas : selectedPrintAreas.map((area) => area.code))
            .filter((area): area is AreaKey => AREA_KEYS.includes(area)),
        ),
      );
      if (previewAreas.length === 0) {
        throw new Error("Select at least one print area before continuing to preview.");
      }
      savePreviewSession(previewSessionId, {
        version: 1,
        productSlug: product.slug,
        productVariantId: selectedVariant.id,
        sourceDraftId,
        step6Message: step6MessageFromSession,
        selectedColor,
        selectedSize,
        selectedAreas: previewAreas,
        designJsonByArea: payloadJsonByArea as Partial<Record<AreaKey, Record<string, unknown>>>,
        previewImageUrls: payloadPreviewByArea as Partial<Record<AreaKey, string>>,
        layerPreviewImageUrls: payloadLayerPreviewByArea as Partial<Record<AreaKey, Record<string, string>>>,
        createdAt: new Date().toISOString(),
      });
      const encodedAreas = encodeURIComponent(previewAreas.join(","));
      router.push(`/customize/${product.slug}/preview?sessionId=${previewSessionId}&areas=${encodedAreas}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to prepare preview.");
    } finally {
      setBusyMessage(null);
    }
  };

  const goToStep = (step: number) => {
    if (step === 1) {
      router.push("/customize");
      return;
    }

    if (step === 6) {
      void continueToPreview();
      return;
    }

    if (step >= 2 && step <= 5) {
      setCurrentStep(step);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 2) {
      router.push("/customize");
      return;
    }

    setCurrentStep((step) => Math.max(2, step - 1));
  };

  const goToNextStep = () => {
    if (currentStep === 5) {
      void continueToPreview();
      return;
    }

    setCurrentStep((step) => Math.min(5, step + 1));
  };

  const onSaveDraftClick = () => {
    if (!canSaveToAccount) {
      openAuthModal({
        mode: "login",
        reason: "Log in to save your design to your account.",
        onSuccess: () => {
          void saveDraft({ manual: true, saveToAccount: true });
        },
      });
      return;
    }

    void saveDraft({ manual: true, saveToAccount: true });
  };

  const closeStepGuidancePopup = () => {
    setShowStepGuidancePopup(false);

    if (!isStepGuidanceStep(currentStep)) {
      return;
    }

    try {
      window.localStorage.setItem(getStepGuidanceStorageKey(currentStep), "1");
    } catch {
      // Ignore storage write failures; popup will reappear if persistence is unavailable.
    }
  };

  const currentStepTitle =
    currentStep === 2
      ? "Color & Size"
      : currentStep === 3
        ? "Text Customization"
        : currentStep === 4
          ? "Image Upload"
          : "Paint Editor";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8">
      {showStepGuidancePopup && currentStep >= 2 && currentStep <= 5 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="step-guidance-title"
            className="relative w-full max-w-2xl rounded-2xl border border-[#000000] bg-[#ffffff] p-5 text-[#000000] shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
          >
            <button
              type="button"
              onClick={closeStepGuidancePopup}
              aria-label="Close popup"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#000000] bg-[#ffffff] text-lg leading-none text-[#000000] transition-colors hover:bg-[#000000] hover:text-[#ffffff]"
            >
              x
            </button>
            <h3 id="step-guidance-title" className="pr-10 text-base font-semibold">
              Design Note
            </h3>
            <p className="mt-2 pr-10 text-sm leading-relaxed">{STEP_GUIDANCE_MESSAGE}</p>
          </div>
        </div>
      )}
      {showSizeChartPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/50 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-chart-title"
            className="relative w-full max-w-3xl rounded-2xl border border-[#000000] bg-[#ffffff] p-5 text-[#000000] shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
          >
            <button
              type="button"
              onClick={() => setShowSizeChartPopup(false)}
              aria-label="Close size chart"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#000000] bg-[#ffffff] text-lg leading-none text-[#000000] transition-colors hover:bg-[#000000] hover:text-[#ffffff]"
            >
              x
            </button>
            <div className="flex items-center gap-2 pr-10">
              <h3 id="size-chart-title" className="text-base font-semibold">Size Chart</h3>
              <Button
                type="button"
                onClick={() => setSizeChartUnit((value) => (value === "in" ? "cm" : "in"))}
                className={FLOW_BUTTON_WHITE_CLASS}
              >
                {sizeChartUnit === "in" ? "cm" : "inches"}
              </Button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border border-[#000000] text-sm">
                <thead className="bg-[#000000] text-[#ffffff]">
                  <tr>
                    <th className="border border-[#000000] px-3 py-2 text-left">Size</th>
                    <th className="border border-[#000000] px-3 py-2 text-left">Chest ({sizeChartUnit})</th>
                    <th className="border border-[#000000] px-3 py-2 text-left">Shoulders ({sizeChartUnit})</th>
                    <th className="border border-[#000000] px-3 py-2 text-left">Sleeve Width ({sizeChartUnit})</th>
                    <th className="border border-[#000000] px-3 py-2 text-left">Sleeve Length ({sizeChartUnit})</th>
                  </tr>
                </thead>
                <tbody>
                  {sizeChartSizes.map((size) => {
                    const chart = SIZE_CHART_INCHES[size];
                    return (
                      <tr key={size} className="bg-[#ffffff]">
                        <td className="border border-[#000000] px-3 py-2 font-medium">{size}</td>
                        <td className="border border-[#000000] px-3 py-2">{formatSizeChartValue(chart.chest, sizeChartUnit)}</td>
                        <td className="border border-[#000000] px-3 py-2">{formatSizeChartValue(chart.shoulders, sizeChartUnit)}</td>
                        <td className="border border-[#000000] px-3 py-2">{formatSizeChartValue(chart.sleeveWidth, sizeChartUnit)}</td>
                        <td className="border border-[#000000] px-3 py-2">{formatSizeChartValue(chart.sleeveLength, sizeChartUnit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Customization Flow</p>
          <h2 className="mt-1 text-lg font-semibold">Step {currentStep}: {currentStepTitle}</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="grid gap-2 md:grid-cols-7">
            {FLOW_STEPS.map((step) => {
              const completed = step.number < currentStep;
              const canOpenPreview = selectedPrintAreas.length > 0;
              const clickable = step.number <= 5 || (step.number === 6 && canOpenPreview);

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => goToStep(step.number)}
                  disabled={!clickable}
                  className={`rounded-xl border px-2 py-2 text-left text-xs transition-colors ${
                    completed ? FLOW_STEP_COMPLETED_CLASS : FLOW_STEP_PENDING_CLASS
                  } ${clickable ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                >
                  <p className="font-semibold">Step {step.number}</p>
                  <p className="mt-0.5">{step.label}</p>
                </button>
              );
            })}
          </div>
          <div className="text-right text-xs text-[#000000]">
            <p>{saveLabel}</p>
            {busyMessage && <p className="text-brand">{busyMessage}</p>}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          {currentStep === 2 && (
            <>
              <Card>
                <CardHeader>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Step 2</p>
                  <h3 className="mt-1 text-lg font-semibold">Color & Size</h3>
                </CardHeader>
                <CardBody className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-[#000000]/60">Color</label>
                    <Select value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}>
                      {colors.map((color) => (
                        <option key={color.code} value={color.code}>
                          {color.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#000000]/60">Size</label>
                    <Select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
                      {sizesForColor.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <p className="text-sm text-[#000000]/70">Base price: {formatInr(selectedVariant?.basePriceInr ?? 0)}</p>
                  <Button
                    type="button"
                    onClick={() => {
                      setSizeChartUnit("in");
                      setShowSizeChartPopup(true);
                    }}
                    className={`w-full ${FLOW_BUTTON_WHITE_CLASS}`}
                  >
                    Size Chart
                  </Button>
                </CardBody>
              </Card>

            </>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Step 3</p>
                <h3 className="mt-1 text-lg font-semibold">Text Controls</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <Input value={textValue} onChange={(event) => setTextValue(event.target.value)} placeholder="Write your text" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Font family</label>
                    <Select value={textFontFamily} onChange={(event) => setTextFontFamily(event.target.value)}>
                      {!FONT_OPTIONS.includes(textFontFamily as (typeof FONT_OPTIONS)[number]) && (
                        <option value={textFontFamily}>{textFontFamily}</option>
                      )}
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Font size</label>
                    <Input type="number" min={10} max={160} value={textSize} onChange={(event) => setTextSize(Number(event.target.value) || 24)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Text color</label>
                    <Input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Weight</label>
                    <Select value={textWeight} onChange={(event) => setTextWeight(event.target.value as "normal" | "bold")}>
                      <option value="normal">Regular</option>
                      <option value="bold">Bold</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Style</label>
                    <Select value={textStyle} onChange={(event) => setTextStyle(event.target.value as "normal" | "italic")}>
                      <option value="normal">Normal</option>
                      <option value="italic">Italic</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Underline</label>
                    <Select value={textUnderline ? "on" : "off"} onChange={(event) => setTextUnderline(event.target.value === "on")}>
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Underline color</label>
                    <Input
                      type="color"
                      value={textUnderlineColor}
                      disabled={!textUnderline}
                      onChange={(event) => setTextUnderlineColor(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Text background</label>
                    <Select value={textBackgroundEnabled ? "on" : "off"} onChange={(event) => setTextBackgroundEnabled(event.target.value === "on")}>
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Background color</label>
                    <Input
                      type="color"
                      value={textBackgroundColor}
                      disabled={!textBackgroundEnabled}
                      onChange={(event) => setTextBackgroundColor(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Degree rotator</label>
                    <Input
                      type="number"
                      min={-360}
                      max={360}
                      value={textRotation}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setTextRotation(Number.isFinite(value) ? Math.max(-360, Math.min(360, value)) : 0);
                      }}
                      placeholder="Degree rotator (-360 to 360)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Flip</label>
                    <Select
                      value={textFlipMode}
                      onChange={(event) =>
                        setTextFlipMode(event.target.value as "none" | "left_to_right" | "upside_down" | "both")
                      }
                    >
                      <option value="none">Flip: None</option>
                      <option value="left_to_right">Flip: Left to Right</option>
                      <option value="upside_down">Flip: Upside Down</option>
                      <option value="both">Flip: Both</option>
                    </Select>
                  </div>
                </div>
                <Button onClick={addText} className={`w-full ${FLOW_BUTTON_WHITE_CLASS}`}>Add Text</Button>
                {renderAreaSelectorButtons()}
                {renderCanvasActionButtons()}
              </CardBody>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Step 4</p>
                <h3 className="mt-1 text-lg font-semibold">Upload Image</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <label className="block text-xs text-[#000000]/60">Upload image (JPG/PNG/WebP, max 10MB)</label>
                <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadImage} />
                <Button onClick={() => void removeImageBackground()} className={`w-full ${FLOW_BUTTON_WHITE_CLASS}`}>
                  Remove Image Background
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Degree rotator</label>
                    <Input
                      type="number"
                      min={-360}
                      max={360}
                      value={imageRotation}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setImageRotation(Number.isFinite(value) ? Math.max(-360, Math.min(360, value)) : 0);
                      }}
                      placeholder="Degree rotator (-360 to 360)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Image background</label>
                    <Select value={imageBackgroundEnabled ? "on" : "off"} onChange={(event) => setImageBackgroundEnabled(event.target.value === "on")}>
                      <option value="off">Off</option>
                      <option value="on">On</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs text-[#000000]/60">Background color</label>
                    <Input
                      type="color"
                      value={imageBackgroundColor}
                      disabled={!imageBackgroundEnabled}
                      onChange={(event) => setImageBackgroundColor(event.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-[#000000]/60">
                  Select the uploaded image on the canvas, then remove its background completely or set a custom image background color.
                </p>
                {renderAreaSelectorButtons()}
                {renderCanvasActionButtons()}
              </CardBody>
            </Card>
          )}

          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Step 5</p>
                <h3 className="mt-1 text-lg font-semibold">Paint Tools</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => setTool("select")} className={tool === "select" ? FLOW_BUTTON_FILLED_CLASS : FLOW_BUTTON_WHITE_CLASS}>Select</Button>
                  <Button onClick={() => setTool("draw")} className={tool === "draw" ? FLOW_BUTTON_FILLED_CLASS : FLOW_BUTTON_WHITE_CLASS}>Draw</Button>
                  <Button onClick={() => setTool("eraser")} className={tool === "eraser" ? FLOW_BUTTON_FILLED_CLASS : FLOW_BUTTON_WHITE_CLASS}>Eraser</Button>
                </div>
                <Button onClick={clearAllStep5Edits} className={`w-full ${FLOW_BUTTON_WHITE_CLASS}`}>Clear All Step 5 Edits</Button>

                <label className="block text-xs text-[#000000]/60">Brush color</label>
                <Input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />

                <label className="block text-xs text-[#000000]/60">Brush width</label>
                <Input type="range" min={1} max={40} value={brushWidth} onChange={(event) => setBrushWidth(Number(event.target.value))} />

                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={addRectangle} className={FLOW_BUTTON_WHITE_CLASS}>Rectangle</Button>
                  <Button onClick={addCircle} className={FLOW_BUTTON_WHITE_CLASS}>Circle</Button>
                  <Button onClick={clearArea} className={FLOW_BUTTON_WHITE_CLASS}>Remove Selected</Button>
                  <Button onClick={() => void redo()} className={FLOW_BUTTON_WHITE_CLASS}>Redo</Button>
                </div>
                <Button onClick={() => setIsPanMode((value) => !value)} className={isPanMode ? FLOW_BUTTON_FILLED_CLASS : FLOW_BUTTON_WHITE_CLASS}>
                  {isPanMode ? "Pan: On" : "Pan: Off"}
                </Button>
                {renderAreaSelectorButtons()}
              </CardBody>
            </Card>
          )}

        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                {currentStep === 2 ? "Selected Product" : `Design Canvas (${activeAreaLabel})`}
              </h3>
              {currentStep >= 2 && currentStep <= 5 && (
                <button
                  type="button"
                  onClick={() => setShowStepGuidancePopup(true)}
                  aria-label="Open design note"
                  title="info*"
                  className="inline-flex h-7 min-w-7 cursor-help items-center justify-center rounded-full border border-[#ff0000] bg-[#ffffff] px-2 text-xs font-semibold text-[#ff0000] transition-colors hover:border-[#cc0000] hover:text-[#cc0000] active:border-[#cc0000] active:text-[#cc0000]"
                >
                  i
                </button>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {currentStep === 2 && (
              <>
                <div className="rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3 backdrop-blur-sm">
                  <div className="mx-auto w-full max-w-[520px] rounded-lg border border-[#ffffff]/80 bg-[#ffffff]">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                      <div className="absolute inset-[2.5%]">
                        <NextImage
                          src={step2FrontImageSrc}
                          alt={`${product.slug.replace(/-/g, " ")} front view`}
                          fill
                          sizes="(max-width: 768px) 100vw, 640px"
                          className="object-contain"
                          priority={false}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#000000]/80">
                  Continue to step 3 to place text on the selected areas.
                </p>
              </>
            )}

            <div className={currentStep === 2 ? "hidden space-y-4" : "space-y-4"}>
              <div className="rounded-2xl border border-[#ffffff]/80 bg-[#ffffff]/75 p-3 backdrop-blur-sm">
                <div className="mx-auto w-full max-w-[520px] rounded-lg border border-[#ffffff]/80 bg-[#ffffff]">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg [&_.canvas-container]:!h-full [&_.canvas-container]:!w-full [&_canvas]:!h-full [&_canvas]:!w-full">
                    <canvas ref={canvasElementRef} className="block h-full w-full rounded-lg" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#000000]/60">
                Use mouse wheel to zoom at cursor. Turn pan on and drag to move the zoomed view.
              </p>
            </div>

            {currentStep >= 3 && warningText.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {warningText.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            {currentStep >= 3 && errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={goToPreviousStep} className={FLOW_BUTTON_WHITE_CLASS}>
          Previous Step
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSaveDraftClick} disabled={isSaving || !selectedVariant} className={FLOW_BUTTON_WHITE_CLASS}>
            {isSaving ? "Saving..." : canSaveToAccount ? "Save Draft" : "Save Draft (Log in)"}
          </Button>
          <Button onClick={goToNextStep} disabled={currentStep === 5 && selectedPrintAreas.length === 0} className={FLOW_BUTTON_WHITE_CLASS}>
            {currentStep === 5 ? "Next: Step 6 Preview" : `Next: Step ${currentStep + 1}`}
          </Button>
        </div>
      </div>
    </div>
  );
}





