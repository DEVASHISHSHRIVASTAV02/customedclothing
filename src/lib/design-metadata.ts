import { type AreaKey, AREA_KEYS, AREA_LABELS } from "@/lib/constants";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { parseJsonObject } from "@/lib/utils";

export const STORED_PREVIEW_AREAS: AreaKey[] = ["front", "back"];

type BuildDesignMetadataTextInput = {
  context: "saved-draft" | "order";
  referenceId: string;
  product: {
    slug: string;
    colorCode?: string;
    colorName?: string;
    sizeCode?: string;
    basePriceInr?: number;
  };
  selectedAreas: AreaKey[];
  designJsonByArea: Partial<Record<AreaKey, unknown>>;
  previewImageUrls: Partial<Record<AreaKey, string>>;
};

type DesignObjectMetadata = {
  id: string;
  area: AreaKey;
  areaLabel: string;
  inferredStep: 3 | 4 | 5;
  type: string;
  transform: {
    left: number | null;
    top: number | null;
    angle: number | null;
    scaleX: number | null;
    scaleY: number | null;
    flipX: boolean | null;
    flipY: boolean | null;
    skewX: number | null;
    skewY: number | null;
  };
  dimensions: {
    width: number | null;
    height: number | null;
  };
  style: {
    fill: string | null;
    stroke: string | null;
    strokeWidth: number | null;
    opacity: number | null;
    backgroundColor: string | null;
  };
  text: {
    value: string | null;
    fontFamily: string | null;
    fontSize: number | null;
    fontWeight: string | number | null;
    fontStyle: string | null;
    textAlign: string | null;
    lineHeight: number | null;
    charSpacing: number | null;
    underline: boolean | null;
    underlineColor: string | null;
    textBackgroundColor: string | null;
  } | null;
  image: {
    source: string | null;
    cropX: number | null;
    cropY: number | null;
    backgroundColor: string | null;
  } | null;
  step5: {
    shapeType: string | null;
    pathPointCount: number | null;
  } | null;
};

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeAreas(input: AreaKey[]) {
  const normalized = input.filter((area): area is AreaKey => AREA_KEYS.includes(area));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["front"];
}

function parseAreaObjects(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const objects = (value as { objects?: unknown }).objects;
  if (!Array.isArray(objects)) {
    return [];
  }

  return objects.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function inferStepFromType(type: string): 3 | 4 | 5 {
  if (type === "textbox") {
    return 3;
  }
  if (type === "image") {
    return 4;
  }
  return 5;
}

function collectObjectMetadata(area: AreaKey, index: number, object: Record<string, unknown>): DesignObjectMetadata | null {
  const name = asString(object.name);
  if (name === "__garment_backdrop__") {
    return null;
  }

  const type = asString(object.type)?.toLowerCase() ?? "unknown";
  const step = inferStepFromType(type);

  const stroke = asString(object.stroke);
  const textValue = asString(object.text);
  const path = Array.isArray(object.path) ? object.path : null;

  return {
    id: `${area}-${type}-${index + 1}`,
    area,
    areaLabel: AREA_LABELS[area],
    inferredStep: step,
    type,
    transform: {
      left: asNumber(object.left),
      top: asNumber(object.top),
      angle: asNumber(object.angle),
      scaleX: asNumber(object.scaleX),
      scaleY: asNumber(object.scaleY),
      flipX: asBoolean(object.flipX),
      flipY: asBoolean(object.flipY),
      skewX: asNumber(object.skewX),
      skewY: asNumber(object.skewY),
    },
    dimensions: {
      width: asNumber(object.width),
      height: asNumber(object.height),
    },
    style: {
      fill: asString(object.fill),
      stroke,
      strokeWidth: asNumber(object.strokeWidth),
      opacity: asNumber(object.opacity),
      backgroundColor: asString(object.backgroundColor),
    },
    text: type === "textbox"
      ? {
          value: textValue,
          fontFamily: asString(object.fontFamily),
          fontSize: asNumber(object.fontSize),
          fontWeight: typeof object.fontWeight === "string" || typeof object.fontWeight === "number"
            ? object.fontWeight
            : null,
          fontStyle: asString(object.fontStyle),
          textAlign: asString(object.textAlign),
          lineHeight: asNumber(object.lineHeight),
          charSpacing: asNumber(object.charSpacing),
          underline: asBoolean(object.underline),
          // Underline color is stored on stroke for text in canvas patching.
          underlineColor: stroke,
          textBackgroundColor: asString(object.textBackgroundColor),
        }
      : null,
    image: type === "image"
      ? {
          source: asString((object as { __originalUploadSrc?: unknown }).__originalUploadSrc),
          cropX: asNumber(object.cropX),
          cropY: asNumber(object.cropY),
          backgroundColor: asString(object.backgroundColor),
        }
      : null,
    step5: type !== "textbox" && type !== "image"
      ? {
          shapeType: type,
          pathPointCount: path ? path.length : null,
        }
      : null,
  };
}

function normalizeDesignJsonByArea(value: Partial<Record<AreaKey, unknown>>) {
  return AREA_KEYS.reduce<Partial<Record<AreaKey, unknown>>>((acc, area) => {
    const areaValue = value[area];
    if (areaValue && typeof areaValue === "object") {
      acc[area] = parseJsonObject<Record<string, unknown>>(areaValue, {});
    }
    return acc;
  }, {});
}

export function buildDesignMetadataText(input: BuildDesignMetadataTextInput) {
  const selectedAreas = normalizeAreas(input.selectedAreas);
  const normalizedDesignJsonByArea = normalizeDesignJsonByArea(input.designJsonByArea);
  const normalizedPreviewByArea = AREA_KEYS.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
    const source = input.previewImageUrls[area];
    if (typeof source === "string" && source.trim().length > 0) {
      acc[area] = source.trim();
    }
    return acc;
  }, {});

  const designObjectsByArea = AREA_KEYS.reduce<Record<AreaKey, DesignObjectMetadata[]>>((acc, area) => {
    const areaObjects = parseAreaObjects(normalizedDesignJsonByArea[area]);
    acc[area] = areaObjects
      .map((object, index) => collectObjectMetadata(area, index, object))
      .filter((entry): entry is DesignObjectMetadata => entry !== null);
    return acc;
  }, {} as Record<AreaKey, DesignObjectMetadata[]>);

  const summary = {
    totalObjects: AREA_KEYS.reduce((sum, area) => sum + designObjectsByArea[area].length, 0),
    byArea: AREA_KEYS.reduce<Record<AreaKey, { total: number; step3Text: number; step4Image: number; step5PaintAndShapes: number }>>(
      (acc, area) => {
        const objects = designObjectsByArea[area];
        acc[area] = {
          total: objects.length,
          step3Text: objects.filter((item) => item.inferredStep === 3).length,
          step4Image: objects.filter((item) => item.inferredStep === 4).length,
          step5PaintAndShapes: objects.filter((item) => item.inferredStep === 5).length,
        };
        return acc;
      },
      {} as Record<AreaKey, { total: number; step3Text: number; step4Image: number; step5PaintAndShapes: number }>,
    ),
  };
  const normalizedProductColor = normalizeCatalogColor({
    colorCode: input.product.colorCode,
    colorName: input.product.colorName,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    context: input.context,
    referenceId: input.referenceId,
    product: {
      slug: input.product.slug,
      colorCode: normalizedProductColor.colorCode || null,
      colorName: normalizedProductColor.colorName || null,
      sizeCode: input.product.sizeCode ?? null,
      basePriceInr: typeof input.product.basePriceInr === "number" ? input.product.basePriceInr : null,
    },
    selectedAreas,
    storedPreviewAreas: STORED_PREVIEW_AREAS,
    previewImageSourcesByArea: normalizedPreviewByArea,
    summary,
    controlsSnapshotByArea: designObjectsByArea,
    rawDesignJsonByArea: normalizedDesignJsonByArea,
  };

  return JSON.stringify(payload, null, 2);
}
