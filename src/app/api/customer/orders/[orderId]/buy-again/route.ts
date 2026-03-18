import { Prisma, PrintAreaCode } from "@prisma/client";
import { AREA_CODE_TO_KEY, AREA_KEYS, type AreaKey, DRAFT_TTL_DAYS } from "@/lib/constants";
import { getCustomerSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  DRAFT_STEP6_MESSAGE_KEY,
  normalizeDraftStep6Message,
  parseDraftStep6Message,
} from "@/lib/draft-preview-storage";
import { parseJsonObject } from "@/lib/utils";
import { buildStoragePublicUrl } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};
const LAYER_PREVIEW_KEYS = ["text", "upload", "edit"] as const;
type LayerPreviewKey = (typeof LAYER_PREVIEW_KEYS)[number];
type LayerPreviewByArea = Partial<Record<AreaKey, Partial<Record<LayerPreviewKey, string>>>>;

function toAreaKeyFromPrintCode(value: unknown): AreaKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const resolved = AREA_CODE_TO_KEY[value as PrintAreaCode];
  return resolved ?? null;
}

function deriveAreasFromOrderItem(printAreaSnapshotJson: unknown): AreaKey[] {
  if (!Array.isArray(printAreaSnapshotJson)) {
    return ["front"];
  }

  const areas = printAreaSnapshotJson
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      return toAreaKeyFromPrintCode((entry as { code?: unknown }).code);
    })
    .filter((area): area is AreaKey => area !== null);

  if (areas.length === 0) {
    return ["front"];
  }

  return Array.from(new Set(areas));
}

function deriveAreasFromDraftPreview(previewImageUrls: unknown): AreaKey[] {
  const preview = parseJsonObject<Record<string, unknown>>(previewImageUrls, {});
  const areas = AREA_KEYS.filter((area) => typeof preview[area] === "string" && String(preview[area]).length > 0);
  return areas.length > 0 ? areas : ["front"];
}

function areaHasDesignObjects(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const objects = (value as { objects?: unknown }).objects;
  if (Array.isArray(objects)) {
    return objects.some((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      return (entry as { name?: unknown }).name !== "__garment_backdrop__";
    });
  }

  return Object.keys(value as Record<string, unknown>).length > 0;
}

function deriveAreasFromDraftDesignOrPreview(
  designJsonByArea: unknown,
  previewImageUrls: unknown,
): AreaKey[] {
  const designByArea = parseJsonObject<Record<string, unknown>>(designJsonByArea, {});
  const areasFromDesign = AREA_KEYS.filter((area) => areaHasDesignObjects(designByArea[area]));
  if (areasFromDesign.length > 0) {
    return areasFromDesign;
  }

  return deriveAreasFromDraftPreview(previewImageUrls);
}

function parseDraftPreviewByArea(value: Record<string, unknown>) {
  return AREA_KEYS.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
    const source = value[area];
    if (typeof source === "string" && source.trim().length > 0) {
      acc[area] = source.trim();
    }
    return acc;
  }, {});
}

function parseDraftLayerPreviewByArea(value: Record<string, unknown>) {
  const nestedLayerSource = (() => {
    const nested = value.layers;
    if (nested && typeof nested === "object") {
      return nested as Record<string, unknown>;
    }
    return value;
  })();

  return AREA_KEYS.reduce<LayerPreviewByArea>((acc, area) => {
    const rawArea = nestedLayerSource[area];
    if (!rawArea || typeof rawArea !== "object") {
      return acc;
    }

    const areaSource = rawArea as Record<string, unknown>;
    const byLayer = LAYER_PREVIEW_KEYS.reduce<Partial<Record<LayerPreviewKey, string>>>((layerAcc, layer) => {
      const source = areaSource[layer];
      if (typeof source === "string" && source.trim().length > 0) {
        layerAcc[layer] = source.trim();
      }
      return layerAcc;
    }, {});

    if (Object.keys(byLayer).length > 0) {
      acc[area] = byLayer;
    }
    return acc;
  }, {});
}

function derivePreviewFromOrderItemDesignExports(value: unknown) {
  const paths = parseJsonObject<Record<string, unknown>>(value, {});
  const previewByArea = AREA_KEYS.reduce<Partial<Record<AreaKey, string>>>((acc, area) => {
    const relativePath = paths[area];
    if (typeof relativePath === "string" && relativePath.trim().length > 0) {
      acc[area] = buildStoragePublicUrl("orders", relativePath.trim());
    }
    return acc;
  }, {});

  return previewByArea;
}

function deriveLayerPreviewFromOrderItemDesignExports(value: unknown) {
  const paths = parseJsonObject<Record<string, unknown>>(value, {});
  return AREA_KEYS.reduce<LayerPreviewByArea>((acc, area) => {
    const byLayer = LAYER_PREVIEW_KEYS.reduce<Partial<Record<LayerPreviewKey, string>>>((layerAcc, layer) => {
      const key = `${area}_${layer}`;
      const relativePath = paths[key];
      if (typeof relativePath === "string" && relativePath.trim().length > 0) {
        layerAcc[layer] = buildStoragePublicUrl("orders", relativePath.trim());
      }
      return layerAcc;
    }, {});

    if (Object.keys(byLayer).length > 0) {
      acc[area] = byLayer;
    }
    return acc;
  }, {});
}

function mergePreviewSources({
  draftPreviewByArea,
  draftLayerPreviewByArea,
  orderPreviewImageUrls,
  orderLayerPreviewByArea,
  selectedAreas,
}: {
  draftPreviewByArea: Partial<Record<AreaKey, string>>;
  draftLayerPreviewByArea: LayerPreviewByArea;
  orderPreviewImageUrls: Partial<Record<AreaKey, string>>;
  orderLayerPreviewByArea: LayerPreviewByArea;
  selectedAreas: AreaKey[];
}) {
  const previewByArea = AREA_KEYS.reduce<Record<string, unknown>>((acc, area) => {
    if (!selectedAreas.includes(area)) {
      return acc;
    }

    const source = orderPreviewImageUrls[area] ?? draftPreviewByArea[area];
    if (typeof source === "string" && source.trim().length > 0) {
      acc[area] = source.trim();
    }
    return acc;
  }, {});

  const layerPreviewByArea = AREA_KEYS.reduce<LayerPreviewByArea>((acc, area) => {
    if (!selectedAreas.includes(area)) {
      return acc;
    }

    const byLayer = LAYER_PREVIEW_KEYS.reduce<Partial<Record<LayerPreviewKey, string>>>((layerAcc, layer) => {
      const source = orderLayerPreviewByArea[area]?.[layer] ?? draftLayerPreviewByArea[area]?.[layer];
      if (typeof source === "string" && source.trim().length > 0) {
        layerAcc[layer] = source.trim();
      }
      return layerAcc;
    }, {});

    if (Object.keys(byLayer).length > 0) {
      acc[area] = byLayer;
    }
    return acc;
  }, {});

  return {
    ...previewByArea,
    ...(Object.keys(layerPreviewByArea).length > 0 ? { layers: layerPreviewByArea } : {}),
  };
}

export async function POST(_request: Request, context: RouteContext) {
  void _request;
  const session = await getCustomerSession();
  if (!session) {
    return fail("Unauthorized", 401);
  }

  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      customerId: session.user.id,
    },
    include: {
      draft: {
        include: {
          productVariant: {
            include: {
              productType: true,
            },
          },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!order) {
    return fail("Order not found.", 404);
  }

  const firstItem = order.items[0] ?? null;
  if (!firstItem && !order.draft) {
    return fail("This order cannot be reused because design data is unavailable.", 409);
  }

  const selectedAreas = firstItem
    ? deriveAreasFromOrderItem(firstItem.printAreaSnapshotJson)
    : deriveAreasFromDraftDesignOrPreview(order.draft?.designJsonByArea, order.draft?.previewImageUrls);
  const firstItemVariantSnapshot = firstItem
    ? parseJsonObject<Record<string, unknown>>(firstItem.productVariantSnapshotJson, {})
    : {};

  const fallbackVariantId = firstItem
    ? (() => {
      const id = firstItemVariantSnapshot.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    })()
    : null;

  const productVariant = order.draft?.productVariant
    ?? (
      fallbackVariantId
        ? await prisma.productVariant.findUnique({
          where: { id: fallbackVariantId },
          include: {
            productType: true,
          },
        })
        : null
    );

  if (!productVariant) {
    return fail("This order cannot be reused because its product variant is unavailable.", 409);
  }

  const rawDraftPreview = order.draft
    ? parseJsonObject<Record<string, unknown>>(order.draft.previewImageUrls ?? {}, {})
    : {};
  const draftPreviewByArea = parseDraftPreviewByArea(rawDraftPreview);
  const draftLayerPreviewByArea = parseDraftLayerPreviewByArea(rawDraftPreview);
  const orderPreviewImageUrls = derivePreviewFromOrderItemDesignExports(firstItem?.designExportPathsJson);
  const orderLayerPreviewByArea = deriveLayerPreviewFromOrderItemDesignExports(firstItem?.designExportPathsJson);
  const previewImageUrls = mergePreviewSources({
    draftPreviewByArea,
    draftLayerPreviewByArea,
    orderPreviewImageUrls,
    orderLayerPreviewByArea,
    selectedAreas,
  });
  const step6MessageFromSnapshot = normalizeDraftStep6Message(firstItemVariantSnapshot.step6Message);
  const step6Message = step6MessageFromSnapshot.length > 0
    ? step6MessageFromSnapshot
    : parseDraftStep6Message(order.draft?.previewImageUrls);
  const previewPayload = {
    ...previewImageUrls,
    ...(step6Message.length > 0 ? { [DRAFT_STEP6_MESSAGE_KEY]: step6Message } : {}),
  };
  const designJsonByArea = order.draft
    ? parseJsonObject<Record<string, unknown>>(order.draft.designJsonByArea ?? {}, {})
    : {};

  const draft = await prisma.designDraft.create({
    data: {
      sessionId: `customer-${session.user.id}-${Date.now()}`,
      customerId: session.user.id,
      savedToAccount: false,
      productVariantId: productVariant.id,
      designJsonByArea: designJsonByArea as Prisma.InputJsonValue,
      previewImageUrls: previewPayload as Prisma.InputJsonValue,
      approved3d: false,
      expiresAt: new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    select: {
      id: true,
    },
  });

  const areasParam = encodeURIComponent(selectedAreas.join(","));
  const checkoutPath = `/customize/${productVariant.productType.slug}/preview?draftId=${draft.id}&areas=${areasParam}`;

  return ok({
    draftId: draft.id,
    checkoutPath,
    selectedAreas,
  });
}
