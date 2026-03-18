import { z } from "zod";
import { AREA_KEYS } from "@/lib/constants";

const areaEnum = z.enum(AREA_KEYS);
const layerPreviewTypeEnum = z.enum(["text", "upload", "edit"]);
const layerPreviewByTypeSchema = z.partialRecord(layerPreviewTypeEnum, z.string().min(4));

export const createDraftSchema = z.object({
  sessionId: z.string().min(3).max(120),
  productVariantId: z.string().min(10),
});

export const patchDraftSchema = z.object({
  designJsonByArea: z.partialRecord(areaEnum, z.unknown()).optional(),
  previewImageUrls: z.partialRecord(areaEnum, z.string().min(4)).optional(),
  layerPreviewImageUrls: z.partialRecord(areaEnum, layerPreviewByTypeSchema).optional(),
  step6Message: z.string().max(2000).optional(),
  approved3d: z.boolean().optional(),
  saveToAccount: z.boolean().optional(),
});

export const exportDraftSchema = z.object({
  areaDataUrls: z.partialRecord(areaEnum, z.string().min(4)).optional(),
  selectedAreas: z.array(areaEnum).min(1),
});

const createOrderBaseSchema = z.object({
  quantity: z.number().int().min(1).max(10),
  selectedAreas: z.array(areaEnum).min(1),
  customerName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^[+0-9]+$/, "Phone must contain only digits and optional +."),
  address: z.object({
    line1: z.string().min(3).max(120),
    line2: z.string().max(120).optional().or(z.literal("")),
    landmark: z.string().max(120).optional().or(z.literal("")),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(80),
    postalCode: z
      .string()
      .min(6)
      .max(10)
      .regex(/^[0-9]+$/, "Postal code must be numeric."),
    country: z.string().default("India"),
  }),
  idempotencyKey: z.string().min(8).max(120),
  step6Message: z.string().max(2000).optional(),
});

export const createOrderSchema = z.union([
  createOrderBaseSchema.extend({
    draftId: z.string().min(10),
  }),
  createOrderBaseSchema.extend({
    productVariantId: z.string().min(10),
    previewImageUrls: z.partialRecord(areaEnum, z.string().min(4)).optional(),
    layerPreviewImageUrls: z.partialRecord(areaEnum, layerPreviewByTypeSchema).optional(),
    designJsonByArea: z.partialRecord(areaEnum, z.unknown()).optional(),
    sourceDraftId: z.string().min(10).optional(),
    approved3d: z.literal(true),
  }),
]);

export const trackOrderSchema = z.object({
  orderCode: z.string().min(6).max(40),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^[+0-9]+$/),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const customerAuthSchema = z.object({
  login: z.string().min(3).max(120),
  password: z.string().min(8).max(128),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email().max(120),
});

export const passwordResetConfirmSchema = z.object({
  email: z.string().email().max(120),
  otp: z.string().regex(/^[0-9]{6}$/, "OTP must be a 6-digit numeric code."),
  newPassword: z.string().min(8).max(128),
});

export const contactSubmissionSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^[+0-9]+$/, "Phone must contain only digits and optional +."),
  subject: z.string().min(3).max(120),
  message: z.string().min(10).max(2000),
});

export const updateCustomerProfileSchema = z.object({
  customerName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z
    .string()
    .min(10)
    .max(15)
    .regex(/^[+0-9]+$/, "Phone must contain only digits and optional +."),
  address: z.object({
    line1: z.string().min(3).max(120),
    line2: z.string().max(120).optional().or(z.literal("")),
    landmark: z.string().max(120).optional().or(z.literal("")),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(80),
    postalCode: z
      .string()
      .min(6)
      .max(10)
      .regex(/^[0-9]+$/, "Postal code must be numeric."),
    country: z.string().default("India"),
  }),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PLACED",
    "CONFIRMED",
    "PRODUCTION",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "FAILED_NOTIFICATION",
  ]),
  note: z.string().max(500).optional(),
});

export const updateCatalogSchema = z.object({
  flatShippingInr: z.number().int().min(0).max(9999).optional(),
  variants: z
    .array(
      z.object({
        id: z.string(),
        basePriceInr: z.number().int().min(100).max(10000),
        active: z.boolean(),
      }),
    )
    .optional(),
  printAreas: z
    .array(
      z.object({
        id: z.string(),
        addonPriceInr: z.number().int().min(0).max(5000),
      }),
    )
    .optional(),
});

