import { type AreaKey, AREA_KEYS } from "@/lib/constants";
import { buildStoragePublicUrl } from "@/lib/storage";
import { parseJsonObject } from "@/lib/utils";

export const DRAFT_LAYER_PREVIEW_KEYS = ["text", "upload", "edit"] as const;
export type DraftLayerPreviewKey = (typeof DRAFT_LAYER_PREVIEW_KEYS)[number];
export const DRAFT_STEP6_MESSAGE_KEY = "step6Message";

const DRAFT_PREVIEW_SUFFIX: Record<AreaKey, string> = {
  front: "front",
  back: "back",
};
const DRAFT_LAYER_PREVIEW_SUFFIX: Record<DraftLayerPreviewKey, string> = {
  text: "text",
  upload: "upload",
  edit: "edit",
};

function isDataImageUrl(value: string) {
  return value.startsWith("data:image/");
}

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isAppRelativeUrl(value: string) {
  return value.startsWith("/");
}

export function normalizeDraftStep6Message(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.slice(0, 2000);
}

export function isStoredDraftPreviewPath(value: string) {
  return !isDataImageUrl(value) && !isHttpUrl(value) && !isAppRelativeUrl(value);
}

export function resolveDraftPreviewSource(value?: string) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  return isStoredDraftPreviewPath(value)
    ? buildStoragePublicUrl("saved-drafts", value)
    : value;
}

export function parseDraftPreviewMap(value: unknown) {
  const parsed = parseJsonObject<Record<string, unknown>>(value, {});
  return AREA_KEYS.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
    const raw = parsed[area];
    if (typeof raw === "string" && raw.trim().length > 0) {
      acc[area] = raw.trim();
    }
    return acc;
  }, {});
}

export function parseDraftLayerPreviewMap(value: unknown) {
  const parsed = parseJsonObject<Record<string, unknown>>(value, {});
  const layerSource = (() => {
    const nested = parsed.layers;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
    return parsed;
  })();

  return AREA_KEYS.reduce<Partial<Record<AreaKey, Partial<Record<DraftLayerPreviewKey, string>>>>>((acc, area) => {
    const rawAreaValue = layerSource[area];
    if (!rawAreaValue || typeof rawAreaValue !== "object") {
      return acc;
    }

    const areaValue = rawAreaValue as Record<string, unknown>;
    const byLayer = DRAFT_LAYER_PREVIEW_KEYS.reduce<Partial<Record<DraftLayerPreviewKey, string>>>((layerAcc, layer) => {
      const rawLayerValue = areaValue[layer];
      if (typeof rawLayerValue === "string" && rawLayerValue.trim().length > 0) {
        layerAcc[layer] = rawLayerValue.trim();
      }
      return layerAcc;
    }, {});

    if (Object.keys(byLayer).length > 0) {
      acc[area] = byLayer;
    }
    return acc;
  }, {});
}

export function parseDraftStep6Message(value: unknown) {
  const parsed = parseJsonObject<Record<string, unknown>>(value, {});
  return normalizeDraftStep6Message(parsed[DRAFT_STEP6_MESSAGE_KEY]);
}

export function resolveDraftLayerPreviewMap(value: unknown) {
  const parsed = parseDraftLayerPreviewMap(value);
  return AREA_KEYS.reduce<Partial<Record<AreaKey, Partial<Record<DraftLayerPreviewKey, string>>>>>((acc, area) => {
    const byLayer = parsed[area];
    if (!byLayer) {
      return acc;
    }

    const resolvedByLayer = DRAFT_LAYER_PREVIEW_KEYS.reduce<Partial<Record<DraftLayerPreviewKey, string>>>((layerAcc, layer) => {
      const source = byLayer[layer];
      if (!source) {
        return layerAcc;
      }
      const resolved = resolveDraftPreviewSource(source);
      if (resolved) {
        layerAcc[layer] = resolved;
      }
      return layerAcc;
    }, {});

    if (Object.keys(resolvedByLayer).length > 0) {
      acc[area] = resolvedByLayer;
    }
    return acc;
  }, {});
}

export function resolveDraftPreviewMap(value: unknown) {
  const parsed = parseDraftPreviewMap(value);
  return AREA_KEYS.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
    const source = parsed[area];
    if (!source) {
      return acc;
    }
    const resolved = resolveDraftPreviewSource(source);
    if (resolved) {
      acc[area] = resolved;
    }
    return acc;
  }, {});
}

export function buildSavedDraftStorageSubdirectory(createdAt: Date, draftId: string) {
  const year = String(createdAt.getFullYear());
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${draftId}`;
}

export function buildSavedDraftPreviewFilename(draftId: string, area: AreaKey) {
  return `${draftId}_${DRAFT_PREVIEW_SUFFIX[area]}.png`;
}

export function buildSavedDraftLayerPreviewFilename(draftId: string, area: AreaKey, layer: DraftLayerPreviewKey) {
  return `${draftId}_${DRAFT_PREVIEW_SUFFIX[area]}_${DRAFT_LAYER_PREVIEW_SUFFIX[layer]}.png`;
}

export function buildSavedDraftDesignMetadataFilename(draftId: string) {
  return `${draftId}_design_metadata.txt`;
}

export function buildSavedDraftDesignReportFilename(draftId: string) {
  return `${draftId}_design_report.docx`;
}
