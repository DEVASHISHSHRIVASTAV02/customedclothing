import { PaymentMethod, PaymentState, OrderStatus, Prisma, type PrintArea } from "@prisma/client";
import { NextRequest } from "next/server";
import { type AreaKey, AREA_KEY_TO_CODE, DRAFT_TTL_DAYS } from "@/lib/constants";
import { buildExportBuffer } from "@/lib/design-export";
import { fail, ok } from "@/lib/http";
import { generateOrderCode } from "@/lib/order-code";
import { prisma } from "@/lib/prisma";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { calculatePricing } from "@/lib/pricing";
import { calculateDesignEditPricePerItemInr } from "@/lib/design-pricing";
import { deleteStoredDirectory, deleteStoredFile, ensureStorageDirs, saveBufferToStorage } from "@/lib/storage";
import { createOrderSchema } from "@/lib/validation";
import { getCustomerSession } from "@/lib/auth";
import {
  DRAFT_STEP6_MESSAGE_KEY,
  DRAFT_LAYER_PREVIEW_KEYS,
  buildSavedDraftStorageSubdirectory,
  normalizeDraftStep6Message,
  parseDraftLayerPreviewMap,
  parseDraftPreviewMap,
  parseDraftStep6Message,
  resolveDraftPreviewSource,
} from "@/lib/draft-preview-storage";
import { parseJsonObject } from "@/lib/utils";
import { STORED_PREVIEW_AREAS } from "@/lib/design-metadata";
import { buildDesignWordReportDocxBuffer } from "@/lib/design-word-report";
import { dispatchOrderNotifications } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

async function nextUniqueOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateOrderCode();
    const exists = await prisma.order.findUnique({ where: { orderCode: code } });
    if (!exists) {
      return code;
    }
  }
  throw new Error("Could not generate unique order code.");
}

function buildOrderResponse(
  order: {
    id: string;
    orderCode: string;
    paymentMethod: PaymentMethod;
    paymentState: PaymentState;
    status: OrderStatus;
    totalInr: number;
  },
  reused = false,
) {
  return {
    orderId: order.id,
    orderCode: order.orderCode,
    paymentMethod: order.paymentMethod,
    paymentState: order.paymentState,
    status: order.status,
    totalInr: order.totalInr,
    confirmationPath: `/order/confirmation/${order.id}`,
    reused,
  };
}

const ORDER_IMAGE_SUFFIX: Record<AreaKey, string> = {
  front: "front",
  back: "back",
};

function buildOrderStorageSubdirectory(orderCode: string) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${orderCode}`;
}

function buildOrderLayerPreviewFilename(
  orderCode: string,
  area: AreaKey,
  layer: (typeof DRAFT_LAYER_PREVIEW_KEYS)[number],
) {
  return `${orderCode}_${ORDER_IMAGE_SUFFIX[area]}_${layer}.png`;
}

function buildOrderDesignReportFilename(orderCode: string) {
  return `${orderCode}_design_report.docx`;
}

type VariantWithPrintAreas = {
  id: string;
  sizeCode: string;
  colorCode: string;
  colorName: string;
  basePriceInr: number;
  productType: {
    slug: string;
    name: string;
    printAreas: Array<{
      code: PrintArea["code"];
      addonPriceInr: number;
      textureSlot: string;
    }>;
  };
};

export async function POST(request: NextRequest) {
  const customerSession = await getCustomerSession();
  if (!customerSession) {
    return fail("You must sign in to place an order.", 401);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await checkRateLimit(`orders:${ip}`, 12, 10 * 60_000);
  if (!limit.allowed) {
    return fail("Too many order attempts. Please wait and retry.", 429);
  }

  const json = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid order payload.", 400, { issues: parsed.error.flatten() });
  }

  const payload = parsed.data;
  const requestedStep6Message = normalizeDraftStep6Message(payload.step6Message);
  const savedOrderImagePaths: string[] = [];
  let createdOrderId: string | null = null;
  let createdTransientDraftId: string | null = null;
  let sourceSavedDraftStorageSubdirectory: string | null = null;
  let sourceSavedDraftId: string | null = null;

  try {
    const existingOrder = await prisma.order.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
      select: {
        id: true,
        orderCode: true,
        paymentMethod: true,
        paymentState: true,
        status: true,
        totalInr: true,
      },
    });

    if (existingOrder) {
      return ok(buildOrderResponse(existingOrder, true));
    }

    let draftReferenceId: string | null = null;
    let productVariant: VariantWithPrintAreas;
    let previewImageUrls: Partial<Record<AreaKey, string>>;
    let layerPreviewImageUrls: Partial<Record<AreaKey, Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>>>>;
    let designJsonByArea: Partial<Record<AreaKey, unknown>> = {};
    let step6Message = requestedStep6Message;

    if ("draftId" in payload) {
      const draft = await prisma.designDraft.findUnique({
        where: { id: payload.draftId },
        include: {
          productVariant: {
            include: {
              productType: {
                include: { printAreas: true },
              },
            },
          },
        },
      });

      if (!draft) {
        return fail("Draft not found.", 404);
      }

      if (draft.customerId && draft.customerId !== customerSession?.user.id) {
        return fail("You do not have access to this draft.", 403);
      }

      if (customerSession && !draft.customerId) {
        await prisma.designDraft.update({
          where: { id: draft.id },
          data: { customerId: customerSession.user.id },
        });
      }

      if (!draft.approved3d) {
        return fail("Please approve the 3D preview before checkout.", 409);
      }

      draftReferenceId = draft.id;
      if (draft.savedToAccount) {
        sourceSavedDraftStorageSubdirectory = buildSavedDraftStorageSubdirectory(draft.createdAt, draft.id);
        sourceSavedDraftId = draft.id;
      }
      productVariant = draft.productVariant as VariantWithPrintAreas;
      previewImageUrls = parseDraftPreviewMap(draft.previewImageUrls);
      layerPreviewImageUrls = parseDraftLayerPreviewMap(draft.previewImageUrls);
      designJsonByArea = parseJsonObject<Record<string, unknown>>(draft.designJsonByArea, {}) as Partial<Record<AreaKey, unknown>>;
      if (step6Message.length === 0) {
        step6Message = parseDraftStep6Message(draft.previewImageUrls);
      }
    } else {
      if (!payload.approved3d) {
        return fail("Please approve the 3D preview before checkout.", 409);
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: payload.productVariantId },
        include: {
          productType: {
            include: { printAreas: true },
          },
        },
      });

      if (!variant || !variant.active || !variant.productType.active) {
        return fail("Selected product variant is not available.", 404);
      }

      let sourceDraftReferenceId: string | null = null;
      const sourceDraftIdCandidate = typeof payload.sourceDraftId === "string" && payload.sourceDraftId.length > 0
        ? payload.sourceDraftId
        : null;
      if (sourceDraftIdCandidate) {
        const sourceDraft = await prisma.designDraft.findUnique({
          where: { id: sourceDraftIdCandidate },
          select: {
            id: true,
            customerId: true,
            savedToAccount: true,
            createdAt: true,
            productVariantId: true,
          },
        });
        if (
          sourceDraft
          && (!sourceDraft.customerId || sourceDraft.customerId === customerSession.user.id)
          && sourceDraft.productVariantId === variant.id
        ) {
          sourceDraftReferenceId = sourceDraft.id;
          if (sourceDraft.savedToAccount) {
            sourceSavedDraftStorageSubdirectory = buildSavedDraftStorageSubdirectory(sourceDraft.createdAt, sourceDraft.id);
            sourceSavedDraftId = sourceDraft.id;
          }
        }
      }

      productVariant = variant as VariantWithPrintAreas;
      previewImageUrls = parseDraftPreviewMap(payload.previewImageUrls ?? {});
      layerPreviewImageUrls = parseDraftLayerPreviewMap(payload.layerPreviewImageUrls ?? {});
      designJsonByArea = parseJsonObject<Record<string, unknown>>(payload.designJsonByArea ?? {}, {}) as Partial<Record<AreaKey, unknown>>;

      const transientPreviewPayload: Record<string, unknown> = { ...previewImageUrls };
      if (step6Message.length > 0) {
        transientPreviewPayload[DRAFT_STEP6_MESSAGE_KEY] = step6Message;
      }
      if (Object.keys(layerPreviewImageUrls).length > 0) {
        transientPreviewPayload.layers = layerPreviewImageUrls;
      }

      if (sourceDraftReferenceId) {
        await prisma.designDraft.update({
          where: { id: sourceDraftReferenceId },
          data: {
            customerId: customerSession.user.id,
            designJsonByArea: designJsonByArea as Prisma.InputJsonValue,
            previewImageUrls: transientPreviewPayload as Prisma.InputJsonValue,
            approved3d: true,
          },
        });
        draftReferenceId = sourceDraftReferenceId;
      } else {
        const transientDraft = await prisma.designDraft.create({
          data: {
            sessionId: `order-${customerSession.user.id}-${Date.now()}`,
            customerId: customerSession.user.id,
            savedToAccount: false,
            productVariantId: productVariant.id,
            designJsonByArea: designJsonByArea as Prisma.InputJsonValue,
            previewImageUrls: transientPreviewPayload as Prisma.InputJsonValue,
            approved3d: true,
            expiresAt: new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000),
          },
          select: {
            id: true,
          },
        });

        draftReferenceId = transientDraft.id;
        createdTransientDraftId = transientDraft.id;
      }
    }

    const matchingPrintAreas = productVariant.productType.printAreas.filter((area) =>
      payload.selectedAreas.some((selectedArea) => AREA_KEY_TO_CODE[selectedArea] === area.code),
    );
    const normalizedVariantColor = normalizeCatalogColor({
      colorCode: productVariant.colorCode,
      colorName: productVariant.colorName,
    });

    if (matchingPrintAreas.length === 0) {
      return fail("At least one print area must be selected.", 400);
    }

    const shopConfig = await prisma.shopConfig.findUnique({ where: { id: "default" } });
    const shippingInr = shopConfig?.flatShippingInr ?? 99;
    const designEditPricePerItemInr = calculateDesignEditPricePerItemInr(designJsonByArea, payload.selectedAreas);

    const pricing = calculatePricing({
      basePriceInr: productVariant.basePriceInr,
      selectedAreas: payload.selectedAreas,
      printAreas: matchingPrintAreas,
      designEditPricePerItemInr,
      quantity: payload.quantity,
      shippingInr,
    });

    const orderCode = await nextUniqueOrderCode();
    const createdOrder = await prisma.order.create({
      data: {
        orderCode,
        idempotencyKey: payload.idempotencyKey,
        customerId: customerSession?.user.id ?? null,
        draftId: draftReferenceId,
        designPreviewImageUrl: null,
        phone: payload.phone,
        email: payload.email,
        customerName: payload.customerName,
        addressJson: payload.address,
        subtotalInr: pricing.subtotalInr,
        shippingInr: pricing.shippingInr,
        totalInr: pricing.totalInr,
        paymentMethod: PaymentMethod.COD,
        paymentState: PaymentState.PENDING_COD,
        status: OrderStatus.PLACED,
        items: {
          create: {
            productVariantSnapshotJson: {
              id: productVariant.id,
              productType: productVariant.productType.name,
              size: productVariant.sizeCode,
              colorCode: normalizedVariantColor.colorCode,
              colorName: normalizedVariantColor.colorName,
              step6Message,
              basePriceInr: productVariant.basePriceInr,
            },
            printAreaSnapshotJson: matchingPrintAreas.map((area) => ({
              code: area.code,
              addonPriceInr: area.addonPriceInr,
              textureSlot: area.textureSlot,
            })),
            designExportPathsJson: {},
            quantity: payload.quantity,
            lineTotalInr: pricing.lineSubtotalInr,
          },
        },
        statusLogs: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PLACED,
            note: "Order created via customer checkout.",
          },
        },
      },
      select: {
        id: true,
        orderCode: true,
        paymentMethod: true,
        paymentState: true,
        status: true,
        totalInr: true,
        items: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    createdOrderId = createdOrder.id;

    const orderItemId = createdOrder.items[0]?.id;
    if (!orderItemId) {
      throw new Error("Order item could not be created.");
    }

    const designExportPaths = {} as Record<string, string>;
    const exportPublicUrls = {} as Partial<Record<AreaKey, string>>;
    const storedLayerPreviewPathsByArea: Partial<Record<AreaKey, Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>>>> = {};
    const storageSubdirectory = buildOrderStorageSubdirectory(createdOrder.orderCode);

    await ensureStorageDirs();
    for (const area of STORED_PREVIEW_AREAS) {
      const source = resolveDraftPreviewSource(previewImageUrls[area]);
      const buffer = await buildExportBuffer(source, {
        productSlug: productVariant.productType.slug,
        area,
      });
      const stored = await saveBufferToStorage({
        kind: "orders",
        buffer,
        filename: `${createdOrder.orderCode}_${ORDER_IMAGE_SUFFIX[area]}.png`,
        subdirectory: storageSubdirectory,
      });

      designExportPaths[area] = stored.relativePath;
      exportPublicUrls[area] = stored.publicUrl;
      savedOrderImagePaths.push(stored.relativePath);
    }

    for (const area of STORED_PREVIEW_AREAS) {
      const byLayer = layerPreviewImageUrls[area];
      if (!byLayer) {
        continue;
      }

      const storedByLayer: Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>> = {};

      for (const layer of DRAFT_LAYER_PREVIEW_KEYS) {
        const source = resolveDraftPreviewSource(byLayer[layer]);
        if (!source) {
          continue;
        }

        const buffer = await buildExportBuffer(source, { background: "white" });
        const stored = await saveBufferToStorage({
          kind: "orders",
          buffer,
          filename: buildOrderLayerPreviewFilename(createdOrder.orderCode, area, layer),
          subdirectory: storageSubdirectory,
        });

        designExportPaths[`${area}_${layer}`] = stored.relativePath;
        storedByLayer[layer] = stored.relativePath;
        savedOrderImagePaths.push(stored.relativePath);
      }

      if (Object.keys(storedByLayer).length > 0) {
        storedLayerPreviewPathsByArea[area] = storedByLayer;
      }
    }

    const designReportDocx = await buildDesignWordReportDocxBuffer({
      context: "order",
      referenceId: createdOrder.orderCode,
      product: {
        slug: productVariant.productType.slug,
        colorCode: normalizedVariantColor.colorCode,
        colorName: normalizedVariantColor.colorName,
        sizeCode: productVariant.sizeCode,
      },
      step6Message,
      designJsonByArea,
      layerPreviewPathsByArea: storedLayerPreviewPathsByArea,
    });
    const reportStored = await saveBufferToStorage({
      kind: "orders",
      buffer: designReportDocx,
      filename: buildOrderDesignReportFilename(createdOrder.orderCode),
      subdirectory: storageSubdirectory,
    });
    designExportPaths.design_report = reportStored.relativePath;
    savedOrderImagePaths.push(reportStored.relativePath);

    const orderPreviewImageUrl = exportPublicUrls.front
      ?? Object.values(exportPublicUrls).find((value): value is string => typeof value === "string" && value.length > 0)
      ?? null;

    const finalizedOrder = await prisma.$transaction(async (transaction) => {
      await transaction.orderItem.update({
        where: { id: orderItemId },
        data: {
          designExportPathsJson: designExportPaths as Prisma.InputJsonValue,
        },
      });

      return transaction.order.update({
        where: { id: createdOrder.id },
        data: {
          designPreviewImageUrl: orderPreviewImageUrl,
        },
        select: {
          id: true,
          orderCode: true,
          paymentMethod: true,
          paymentState: true,
          status: true,
          totalInr: true,
        },
      });
    });

    if (sourceSavedDraftStorageSubdirectory) {
      await deleteStoredDirectory("saved-drafts", sourceSavedDraftStorageSubdirectory).catch((cleanupError) => {
        const detail = cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error.";
        console.error(
          `[orders] placed order ${finalizedOrder.id} but failed to delete saved draft storage for draft ${sourceSavedDraftId ?? "unknown"}: ${detail}`,
        );
      });
    }
    await dispatchOrderNotifications(finalizedOrder.id).catch((notifyError) => {
      const detail = notifyError instanceof Error ? notifyError.message : "Unknown notification dispatch error.";
      console.error(`[orders] placed order ${finalizedOrder.id} but notifications failed: ${detail}`);
    });

    return ok(buildOrderResponse(finalizedOrder));
  } catch (error) {
    if (savedOrderImagePaths.length > 0) {
      await Promise.allSettled(savedOrderImagePaths.map((relativePath) => deleteStoredFile("orders", relativePath)));
    }

    if (createdOrderId) {
      await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => undefined);
    }

    if (createdTransientDraftId) {
      await prisma.designDraft.delete({ where: { id: createdTransientDraftId } }).catch(() => undefined);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey: payload.idempotencyKey },
        select: {
          id: true,
          orderCode: true,
          paymentMethod: true,
          paymentState: true,
          status: true,
          totalInr: true,
        },
      });

      if (existingOrder) {
        return ok(buildOrderResponse(existingOrder, true));
      }
    }

    const detail = error instanceof Error ? error.message : "Unexpected error.";
    return fail(
      "Unable to place order right now. Please try again.",
      500,
      process.env.NODE_ENV === "development" ? { detail } : undefined,
    );
  }
}

