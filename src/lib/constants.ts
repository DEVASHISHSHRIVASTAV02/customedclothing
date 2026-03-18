import { OrderStatus, PrintAreaCode } from "@prisma/client";

export const AREA_KEYS = ["front", "back"] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

const AREA_CODE_TO_KEY_BASE = {
  FRONT: "front",
  BACK: "back",
} as const satisfies Partial<Record<PrintAreaCode, AreaKey>>;

export const AREA_CODE_TO_KEY = AREA_CODE_TO_KEY_BASE as Record<PrintAreaCode, AreaKey>;

export const AREA_KEY_TO_CODE: Record<AreaKey, PrintAreaCode> = {
  front: PrintAreaCode.FRONT,
  back: PrintAreaCode.BACK,
};

export const AREA_LABELS: Record<AreaKey, string> = {
  front: "Front",
  back: "Back",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.PRODUCTION,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const AUTOSAVE_DEFAULT_MS = 10_000;
export const DRAFT_TTL_DAYS = 7;

