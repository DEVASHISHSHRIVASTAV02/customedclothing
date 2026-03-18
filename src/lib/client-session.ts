"use client";

import { v4 as uuidv4 } from "uuid";
import { type AreaKey, AREA_KEYS } from "@/lib/constants";

const SESSION_STORAGE_KEY = "cc_design_session_id";
const PREVIEW_SESSION_PREFIX = "cc_preview_session_";
const MAX_PREVIEW_SESSIONS = 2;
const LAYER_PREVIEW_TYPES = ["text", "upload", "edit"] as const;
type LayerPreviewType = (typeof LAYER_PREVIEW_TYPES)[number];

export type LocalPreviewSession = {
  version: 1;
  productSlug: string;
  productVariantId: string;
  sourceDraftId?: string;
  step6Message?: string;
  selectedColor: string;
  selectedSize: string;
  selectedAreas: AreaKey[];
  designJsonByArea: Partial<Record<AreaKey, Record<string, unknown>>>;
  previewImageUrls: Partial<Record<AreaKey, string>>;
  layerPreviewImageUrls: Partial<Record<AreaKey, Partial<Record<LayerPreviewType, string>>>>;
  createdAt: string;
};

function getPreviewSessionStorageKey(sessionId: string) {
  return `${PREVIEW_SESSION_PREFIX}${sessionId}`;
}

function isQuotaExceededError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return false;
  }

  return error.name === "QuotaExceededError"
    || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error.code === 22
    || error.code === 1014;
}

function parseSessionCreatedAt(raw: string | null) {
  if (!raw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(raw) as { createdAt?: unknown };
    if (typeof parsed.createdAt !== "string") {
      return 0;
    }
    const value = Date.parse(parsed.createdAt);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function clearOtherPreviewSessions(keepSessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const keepKey = getPreviewSessionStorageKey(keepSessionId);
  const entries: Array<{ key: string; createdAt: number }> = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(PREVIEW_SESSION_PREFIX) || key === keepKey) {
      continue;
    }
    entries.push({
      key,
      createdAt: parseSessionCreatedAt(window.localStorage.getItem(key)),
    });
  }

  entries.sort((a, b) => b.createdAt - a.createdAt);
  for (let index = MAX_PREVIEW_SESSIONS - 1; index < entries.length; index += 1) {
    window.localStorage.removeItem(entries[index].key);
  }
}

export function getOrCreateDesignSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = uuidv4();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

export function createPreviewSessionId() {
  return uuidv4();
}

export function savePreviewSession(sessionId: string, payload: LocalPreviewSession) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  const key = getPreviewSessionStorageKey(sessionId);
  clearOtherPreviewSessions(sessionId);

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      throw error;
    }
  }

  // Retry after clearing all older preview sessions.
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const existingKey = window.localStorage.key(index);
    if (!existingKey || !existingKey.startsWith(PREVIEW_SESSION_PREFIX) || existingKey === key) {
      continue;
    }
    window.localStorage.removeItem(existingKey);
    index -= 1;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
    return;
  } catch (retryError) {
    if (!isQuotaExceededError(retryError)) {
      throw retryError;
    }
  }

  // Last fallback for very large canvases: keep preview images for Step 6,
  // but drop detailed design JSON from temporary session storage.
  const minimalPayload: LocalPreviewSession = {
    ...payload,
    designJsonByArea: {},
    layerPreviewImageUrls: {},
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(minimalPayload));
  } catch (finalError) {
    if (isQuotaExceededError(finalError)) {
      throw new Error("Preview is too large for browser storage. Please simplify the design and try again.");
    }
    throw finalError;
  }
}

function parseAreaKeys(value: unknown): AreaKey[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is AreaKey => typeof item === "string" && AREA_KEYS.includes(item as AreaKey));
}

function parseAreaObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const result: Partial<Record<AreaKey, Record<string, unknown>>> = {};
  for (const area of AREA_KEYS) {
    const entry = record[area];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      result[area] = entry as Record<string, unknown>;
    }
  }
  return result;
}

function parsePreviewObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const result: Partial<Record<AreaKey, string>> = {};
  for (const area of AREA_KEYS) {
    const entry = record[area];
    if (typeof entry === "string" && entry.length > 0) {
      result[area] = entry;
    }
  }
  return result;
}

function parseLayerPreviewObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const result: Partial<Record<AreaKey, Partial<Record<LayerPreviewType, string>>>> = {};
  for (const area of AREA_KEYS) {
    const areaValue = record[area];
    if (!areaValue || typeof areaValue !== "object") {
      continue;
    }

    const byType = areaValue as Record<string, unknown>;
    const parsedByType = LAYER_PREVIEW_TYPES.reduce<Partial<Record<LayerPreviewType, string>>>((acc, type) => {
      const entry = byType[type];
      if (typeof entry === "string" && entry.length > 0) {
        acc[type] = entry;
      }
      return acc;
    }, {});

    if (Object.keys(parsedByType).length > 0) {
      result[area] = parsedByType;
    }
  }

  return result;
}

function parseStep6Message(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, 2000);
}

export function readPreviewSession(sessionId: string): LocalPreviewSession | null {
  if (typeof window === "undefined" || !sessionId) {
    return null;
  }

  const raw = window.localStorage.getItem(getPreviewSessionStorageKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalPreviewSession>;
    if (
      parsed.version !== 1
      || typeof parsed.productSlug !== "string"
      || typeof parsed.productVariantId !== "string"
      || typeof parsed.selectedColor !== "string"
      || typeof parsed.selectedSize !== "string"
      || typeof parsed.createdAt !== "string"
    ) {
      return null;
    }

    const selectedAreas = parseAreaKeys(parsed.selectedAreas);
    const sourceDraftId = typeof parsed.sourceDraftId === "string" && parsed.sourceDraftId.length > 0
      ? parsed.sourceDraftId
      : undefined;
    const step6Message = parseStep6Message(parsed.step6Message);
    return {
      version: 1,
      productSlug: parsed.productSlug,
      productVariantId: parsed.productVariantId,
      sourceDraftId,
      step6Message,
      selectedColor: parsed.selectedColor,
      selectedSize: parsed.selectedSize,
      selectedAreas: selectedAreas.length > 0 ? selectedAreas : ["front"],
      designJsonByArea: parseAreaObject(parsed.designJsonByArea),
      previewImageUrls: parsePreviewObject(parsed.previewImageUrls),
      layerPreviewImageUrls: parseLayerPreviewObject(parsed.layerPreviewImageUrls),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function removePreviewSession(sessionId: string) {
  if (typeof window === "undefined" || !sessionId) {
    return;
  }

  window.localStorage.removeItem(getPreviewSessionStorageKey(sessionId));
}
