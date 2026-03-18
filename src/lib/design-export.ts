import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";
import { type AreaKey } from "@/lib/constants";
import { buildAbsoluteUrl } from "@/lib/utils";
import { isStorageKind, readStoredFile } from "@/lib/storage";
import { isComposedPreviewSource } from "@/lib/preview-source";

export const PRINT_WIDTH = 3600;
export const PRINT_HEIGHT = 4800;
const EDITOR_CANVAS_SIZE = 640;
const EDITOR_CANVAS_PADDING = 16;

type BuildExportBufferOptions = {
  productSlug?: string;
  area?: AreaKey;
  background?: "transparent" | "white";
};

type BaseImageSet = {
  front: string;
  back?: string;
  fallback: string;
};

const BASE_IMAGE_PATH_BY_PRODUCT: Record<string, BaseImageSet> = {
  shirt: {
    front: "PreviewImages/Tshirt/Tshirt_1.png",
    back: "PreviewImages/Tshirt/Tshirt_7.png",
    fallback: "PreviewImages/Tshirt/Tshirt_1.png",
  },
};

function resolveBaseImageRelativePath(productSlug?: string, area?: AreaKey) {
  if (!productSlug || !area) {
    return null;
  }

  const imageSet = BASE_IMAGE_PATH_BY_PRODUCT[productSlug];
  if (!imageSet) {
    return null;
  }

  if (area === "front") {
    return imageSet.front;
  }

  if (area === "back") {
    return imageSet.back ?? imageSet.front ?? imageSet.fallback;
  }

  return imageSet.fallback;
}

async function resolveBaseImageBuffer(options?: BuildExportBufferOptions) {
  const relativePath = resolveBaseImageRelativePath(options?.productSlug, options?.area);
  if (!relativePath) {
    return null;
  }

  const absolutePath = path.resolve(process.cwd(), relativePath);
  try {
    return await fs.readFile(absolutePath);
  } catch {
    return null;
  }
}

function getFittedRectInEditorCanvas(sourceWidth: number, sourceHeight: number) {
  const availableSize = EDITOR_CANVAS_SIZE - EDITOR_CANVAS_PADDING * 2;
  const fitScale = Math.min(availableSize / sourceWidth, availableSize / sourceHeight);
  const fittedWidth = sourceWidth * fitScale;
  const fittedHeight = sourceHeight * fitScale;
  return {
    x: (EDITOR_CANVAS_SIZE - fittedWidth) / 2,
    y: (EDITOR_CANVAS_SIZE - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

async function composeGarmentWithOverlay(baseBuffer: Buffer, overlayBuffer?: Buffer | null) {
  if (!overlayBuffer) {
    return baseBuffer;
  }

  const baseImage = sharp(baseBuffer);
  const baseMeta = await baseImage.metadata();
  const baseWidth = baseMeta.width ?? 0;
  const baseHeight = baseMeta.height ?? 0;
  if (baseWidth <= 0 || baseHeight <= 0) {
    return overlayBuffer;
  }

  const overlayMeta = await sharp(overlayBuffer).metadata();
  const overlayWidth = overlayMeta.width ?? 0;
  const overlayHeight = overlayMeta.height ?? 0;
  if (overlayWidth <= 0 || overlayHeight <= 0) {
    return baseBuffer;
  }

  const editorRect = getFittedRectInEditorCanvas(baseWidth, baseHeight);
  const scaleX = overlayWidth / EDITOR_CANVAS_SIZE;
  const scaleY = overlayHeight / EDITOR_CANVAS_SIZE;
  const left = clampInteger(editorRect.x * scaleX, 0, Math.max(0, overlayWidth - 1));
  const top = clampInteger(editorRect.y * scaleY, 0, Math.max(0, overlayHeight - 1));
  const maxExtractWidth = Math.max(1, overlayWidth - left);
  const maxExtractHeight = Math.max(1, overlayHeight - top);
  const width = clampInteger(editorRect.width * scaleX, 1, maxExtractWidth);
  const height = clampInteger(editorRect.height * scaleY, 1, maxExtractHeight);

  const overlayLayer = await sharp(overlayBuffer)
    .extract({
      left,
      top,
      width,
      height,
    })
    .resize(baseWidth, baseHeight, {
      fit: "fill",
    })
    .png()
    .toBuffer();

  return baseImage
    .composite([
      {
        input: overlayLayer,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return Buffer.from(match[2], "base64");
}

async function fetchBuffer(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function parseStorageLocation(value: string) {
  const storageBasePath = (process.env.PUBLIC_STORAGE_BASE_URL ?? "/api/storage").replace(/\/+$/, "");
  const pathname = (() => {
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
      try {
        const url = value.startsWith("/")
          ? new URL(value, "http://localhost")
          : new URL(value);
        return url.pathname;
      } catch {
        if (value.startsWith("/")) {
          return value.split(/[?#]/, 1)[0] ?? null;
        }
        return null;
      }
    }
    return value;
  })();

  if (!pathname) {
    return null;
  }

  const normalizedPath = pathname.replace(/\/+$/, "");
  if (!normalizedPath.startsWith(`${storageBasePath}/`)) {
    return null;
  }

  const suffix = normalizedPath.slice(storageBasePath.length + 1);
  const segments = suffix.split("/").filter((segment) => segment.length > 0);
  const kind = segments[0];
  if (!kind || !isStorageKind(kind)) {
    return null;
  }

  const relativeSegments = segments.slice(1);
  if (relativeSegments.length === 0) {
    return null;
  }

  try {
    const decodedSegments = relativeSegments.map((segment) => decodeURIComponent(segment));
    return {
      kind,
      relativePath: decodedSegments.join("/"),
    };
  } catch {
    return null;
  }
}

export async function resolveBufferFromInput(value?: string) {
  if (!value) {
    return null;
  }

  const decoded = decodeDataUrl(value);
  if (decoded) {
    return decoded;
  }

  const storageLocation = parseStorageLocation(value);
  if (storageLocation) {
    try {
      return await readStoredFile(storageLocation.kind, storageLocation.relativePath);
    } catch {
      return null;
    }
  }

  if (value.startsWith("/")) {
    return fetchBuffer(buildAbsoluteUrl(value));
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return fetchBuffer(value);
  }

  return null;
}

export async function buildExportBuffer(source?: string, options?: BuildExportBufferOptions) {
  const overlayBuffer = await resolveBufferFromInput(source);
  const baseBuffer = await resolveBaseImageBuffer(options);
  const sourceAlreadyComposed = isComposedPreviewSource(source);
  const shouldUseWhiteBackground = options?.background === "white";
  const resizeBackground = shouldUseWhiteBackground
    ? { r: 255, g: 255, b: 255, alpha: 1 }
    : { r: 255, g: 255, b: 255, alpha: 0 };

  let inputBuffer: Buffer | null = overlayBuffer;
  if (baseBuffer) {
    if (overlayBuffer) {
      // Stored preview images from /saved-drafts or /orders are already garment-composed.
      // Re-composing them causes a visible double-overlay artifact.
      inputBuffer = sourceAlreadyComposed
        ? overlayBuffer
        : await composeGarmentWithOverlay(baseBuffer, overlayBuffer);
    } else {
      inputBuffer = baseBuffer;
    }
  }

  if (!inputBuffer) {
    return sharp({
      create: {
        width: PRINT_WIDTH,
        height: PRINT_HEIGHT,
        channels: 4,
        background: resizeBackground,
      },
    })
      .png({ compressionLevel: 9 })
      .withMetadata({ density: 300 })
      .toBuffer();
  }

  let output = sharp(inputBuffer).resize(PRINT_WIDTH, PRINT_HEIGHT, {
    fit: "contain",
    background: resizeBackground,
  });

  if (shouldUseWhiteBackground) {
    output = output.flatten({ background: "#ffffff" });
  }

  return output
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 300 })
    .toBuffer();
}
