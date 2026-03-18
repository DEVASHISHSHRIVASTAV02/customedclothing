import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { patchDraftSchema } from "@/lib/validation";
import { fail, ok } from "@/lib/http";
import { buildExportBuffer } from "@/lib/design-export";
import { parseJsonObject } from "@/lib/utils";
import { mergeDraftAreaData } from "@/lib/draft-merge";
import { getCustomerSession } from "@/lib/auth";
import { type AreaKey } from "@/lib/constants";
import { normalizeCatalogColor } from "@/lib/color-catalog";
import { deleteStoredDirectory, ensureStorageDirs, saveBufferToStorage } from "@/lib/storage";
import {
  DRAFT_STEP6_MESSAGE_KEY,
  DRAFT_LAYER_PREVIEW_KEYS,
  buildSavedDraftDesignReportFilename,
  buildSavedDraftLayerPreviewFilename,
  buildSavedDraftPreviewFilename,
  buildSavedDraftStorageSubdirectory,
  normalizeDraftStep6Message,
  parseDraftLayerPreviewMap,
  parseDraftPreviewMap,
  parseDraftStep6Message,
  resolveDraftLayerPreviewMap,
  resolveDraftPreviewMap,
  resolveDraftPreviewSource,
} from "@/lib/draft-preview-storage";
import { STORED_PREVIEW_AREAS } from "@/lib/design-metadata";
import { buildDesignWordReportDocxBuffer } from "@/lib/design-word-report";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LayerPreviewByArea = Partial<Record<AreaKey, Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>>>>;

function appendVersionToPreviewUrl(source: string, versionToken: string) {
  if (!source || source.startsWith("data:image/")) {
    return source;
  }

  try {
    const isAbsolute = source.startsWith("http://") || source.startsWith("https://");
    const url = isAbsolute ? new URL(source) : new URL(source, "http://localhost");
    url.searchParams.set("v", versionToken);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const separator = source.includes("?") ? "&" : "?";
    return `${source}${separator}v=${encodeURIComponent(versionToken)}`;
  }
}

function withPreviewVersion(previewByArea: Partial<Record<AreaKey, string>>, versionToken: string) {
  return Object.fromEntries(
    Object.entries(previewByArea).map(([area, source]) => [
      area,
      typeof source === "string" && source.length > 0
        ? appendVersionToPreviewUrl(source, versionToken)
        : source,
    ]),
  ) as Partial<Record<AreaKey, string>>;
}

function withLayerPreviewVersion(layerPreviewByArea: LayerPreviewByArea, versionToken: string) {
  return Object.fromEntries(
    Object.entries(layerPreviewByArea).map(([area, byLayer]) => {
      if (!byLayer) {
        return [area, byLayer];
      }

      const nextByLayer = Object.fromEntries(
        Object.entries(byLayer).map(([layer, source]) => [
          layer,
          typeof source === "string" && source.length > 0
            ? appendVersionToPreviewUrl(source, versionToken)
            : source,
        ]),
      );
      return [area, nextByLayer];
    }),
  ) as LayerPreviewByArea;
}

function mergeLayerPreviewByArea({
  currentLayerPreview,
  incomingLayerPreviewPayload,
}: {
  currentLayerPreview: LayerPreviewByArea;
  incomingLayerPreviewPayload: unknown;
}) {
  const incomingLayerPreview = parseDraftLayerPreviewMap(incomingLayerPreviewPayload);
  const rawIncoming = parseJsonObject<Record<string, unknown>>(incomingLayerPreviewPayload, {});

  return STORED_PREVIEW_AREAS.reduce<LayerPreviewByArea>((acc, area) => {
    const hasIncomingArea = Object.prototype.hasOwnProperty.call(rawIncoming, area);
    if (hasIncomingArea) {
      const incomingByArea = incomingLayerPreview[area];
      if (incomingByArea && Object.keys(incomingByArea).length > 0) {
        acc[area] = incomingByArea;
      }
      return acc;
    }

    const currentByArea = currentLayerPreview[area];
    if (currentByArea && Object.keys(currentByArea).length > 0) {
      acc[area] = currentByArea;
    }
    return acc;
  }, {});
}

export async function GET(_request: NextRequest, context: RouteContext) {
  void _request;
  const customerSession = await getCustomerSession();
  const { id } = await context.params;

  const draft = await prisma.designDraft.findUnique({
    where: { id },
    include: {
      productVariant: {
        include: {
          productType: {
            include: {
              printAreas: true,
            },
          },
        },
      },
      uploadedAssets: true,
    },
  });

  if (!draft) {
    return fail("Draft not found.", 404);
  }

  if (draft.customerId && draft.customerId !== customerSession?.user.id) {
    return fail("You do not have access to this draft.", 403);
  }

  const previewVersion = String(draft.updatedAt.getTime());
  const normalizedDraftColor = normalizeCatalogColor({
    colorCode: draft.productVariant.colorCode,
    colorName: draft.productVariant.colorName,
  });

  return ok({
    draft: {
      id: draft.id,
      sessionId: draft.sessionId,
      productVariantId: draft.productVariantId,
      productVariant: {
        ...draft.productVariant,
        colorCode: normalizedDraftColor.colorCode,
        colorName: normalizedDraftColor.colorName,
      },
      productType: draft.productVariant.productType,
      designJsonByArea: parseJsonObject(draft.designJsonByArea, {}),
      previewImageUrls: withPreviewVersion(resolveDraftPreviewMap(draft.previewImageUrls), previewVersion),
      layerPreviewImageUrls: withLayerPreviewVersion(resolveDraftLayerPreviewMap(draft.previewImageUrls), previewVersion),
      approved3d: draft.approved3d,
      step6Message: parseDraftStep6Message(draft.previewImageUrls),
      uploadedAssets: draft.uploadedAssets,
      expiresAt: draft.expiresAt,
      updatedAt: draft.updatedAt,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const customerSession = await getCustomerSession();
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = patchDraftSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid draft update payload.", 400, { issues: parsed.error.flatten() });
  }

  const existing = await prisma.designDraft.findUnique({
    where: { id },
    include: {
      productVariant: {
        include: {
          productType: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });
  if (!existing) {
    return fail("Draft not found.", 404);
  }

  if (existing.customerId && existing.customerId !== customerSession?.user.id) {
    return fail("You do not have access to this draft.", 403);
  }

  const currentDesign = parseJsonObject<Record<string, unknown>>(existing.designJsonByArea, {});
  const currentPreviewPayload = parseJsonObject<Record<string, unknown>>(existing.previewImageUrls, {});
  const currentPreview = parseDraftPreviewMap(existing.previewImageUrls);
  const currentLayerPreview = parseDraftLayerPreviewMap(existing.previewImageUrls);
  const currentStep6Message = parseDraftStep6Message(existing.previewImageUrls);
  const nextStep6Message = parsed.data.step6Message !== undefined
    ? normalizeDraftStep6Message(parsed.data.step6Message)
    : currentStep6Message;
  const shouldSaveToAccount = parsed.data.saveToAccount === true;
  const hasDraftPayload = parsed.data.designJsonByArea !== undefined
    || parsed.data.previewImageUrls !== undefined
    || parsed.data.layerPreviewImageUrls !== undefined;

  if (shouldSaveToAccount && !customerSession) {
    return fail("Please log in to save drafts to your account.", 401);
  }

  if (hasDraftPayload && !shouldSaveToAccount) {
    return fail("Use Save Draft to persist design changes.", 409);
  }

  const mergedDesign = mergeDraftAreaData(currentDesign, parsed.data.designJsonByArea ?? {});
  const mergedPreview = parseDraftPreviewMap(mergeDraftAreaData(currentPreview, parsed.data.previewImageUrls ?? {}));
  const mergedLayerPreview = parsed.data.layerPreviewImageUrls !== undefined
    ? mergeLayerPreviewByArea({
      currentLayerPreview,
      incomingLayerPreviewPayload: parsed.data.layerPreviewImageUrls,
    })
    : currentLayerPreview;
  let nextPreview: Prisma.InputJsonValue = existing.previewImageUrls as Prisma.InputJsonValue;

  if (!shouldSaveToAccount && parsed.data.step6Message !== undefined) {
    const nextPreviewPayload = { ...currentPreviewPayload };
    if (nextStep6Message.length > 0) {
      nextPreviewPayload[DRAFT_STEP6_MESSAGE_KEY] = nextStep6Message;
    } else {
      delete nextPreviewPayload[DRAFT_STEP6_MESSAGE_KEY];
    }
    nextPreview = nextPreviewPayload as Prisma.InputJsonValue;
  }

  if (shouldSaveToAccount) {
    const storageSubdirectory = buildSavedDraftStorageSubdirectory(existing.createdAt, existing.id);
    const storedPreviewPaths: Record<string, string> = {};
    const storedLayerPreviewPaths: Partial<Record<AreaKey, Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>>>> = {};
    const preparedPreviewBuffers: Partial<Record<AreaKey, Buffer>> = {};
    const preparedLayerPreviewBuffers: Partial<
      Record<AreaKey, Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], Buffer>>>
    > = {};

    for (const area of STORED_PREVIEW_AREAS) {
      const source = resolveDraftPreviewSource(mergedPreview[area]);
      preparedPreviewBuffers[area] = await buildExportBuffer(source, {
        productSlug: existing.productVariant.productType.slug,
        area,
      });
    }

    for (const area of STORED_PREVIEW_AREAS) {
      const byLayer = mergedLayerPreview[area];
      if (!byLayer) {
        continue;
      }

      const preparedByLayer: Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], Buffer>> = {};

      for (const layer of DRAFT_LAYER_PREVIEW_KEYS) {
        const source = resolveDraftPreviewSource(byLayer[layer]);
        if (!source) {
          continue;
        }

        preparedByLayer[layer] = await buildExportBuffer(source, { background: "white" });
      }

      if (Object.keys(preparedByLayer).length > 0) {
        preparedLayerPreviewBuffers[area] = preparedByLayer;
      }
    }

    await ensureStorageDirs();
    await deleteStoredDirectory("saved-drafts", storageSubdirectory);

    for (const area of STORED_PREVIEW_AREAS) {
      const buffer = preparedPreviewBuffers[area];
      if (!buffer) {
        continue;
      }

      const stored = await saveBufferToStorage({
        kind: "saved-drafts",
        buffer,
        filename: buildSavedDraftPreviewFilename(existing.id, area),
        subdirectory: storageSubdirectory,
      });
      storedPreviewPaths[area] = stored.relativePath;
    }

    for (const area of STORED_PREVIEW_AREAS) {
      const preparedByLayer = preparedLayerPreviewBuffers[area];
      if (!preparedByLayer) {
        continue;
      }

      const storedByLayer: Partial<Record<(typeof DRAFT_LAYER_PREVIEW_KEYS)[number], string>> = {};

      for (const layer of DRAFT_LAYER_PREVIEW_KEYS) {
        const buffer = preparedByLayer[layer];
        if (!buffer) {
          continue;
        }

        const stored = await saveBufferToStorage({
          kind: "saved-drafts",
          buffer,
          filename: buildSavedDraftLayerPreviewFilename(existing.id, area, layer),
          subdirectory: storageSubdirectory,
        });
        storedByLayer[layer] = stored.relativePath;
      }

      if (Object.keys(storedByLayer).length > 0) {
        storedLayerPreviewPaths[area] = storedByLayer;
      }
    }

    const normalizedExistingColor = normalizeCatalogColor({
      colorCode: existing.productVariant.colorCode,
      colorName: existing.productVariant.colorName,
    });
    const designReportDocx = await buildDesignWordReportDocxBuffer({
      context: "saved-draft",
      referenceId: existing.id,
      product: {
        slug: existing.productVariant.productType.slug,
        colorCode: normalizedExistingColor.colorCode,
        colorName: normalizedExistingColor.colorName,
        sizeCode: existing.productVariant.sizeCode,
      },
      step6Message: nextStep6Message,
      designJsonByArea: mergedDesign as Partial<Record<AreaKey, unknown>>,
      layerPreviewPathsByArea: storedLayerPreviewPaths,
    });
    const reportStored = await saveBufferToStorage({
      kind: "saved-drafts",
      buffer: designReportDocx,
      filename: buildSavedDraftDesignReportFilename(existing.id),
      subdirectory: storageSubdirectory,
    });
    storedPreviewPaths.design_report = reportStored.relativePath;

    nextPreview = {
      ...storedPreviewPaths,
      ...(nextStep6Message.length > 0 ? { [DRAFT_STEP6_MESSAGE_KEY]: nextStep6Message } : {}),
      ...(Object.keys(storedLayerPreviewPaths).length > 0 ? { layers: storedLayerPreviewPaths } : {}),
    } as Prisma.InputJsonValue;
  }

  const updated = await prisma.designDraft.update({
    where: { id },
    data: {
      customerId: shouldSaveToAccount ? customerSession?.user.id ?? existing.customerId : existing.customerId,
      savedToAccount: shouldSaveToAccount ? true : existing.savedToAccount,
      designJsonByArea: mergedDesign as Prisma.InputJsonValue,
      previewImageUrls: nextPreview,
      approved3d: parsed.data.approved3d ?? existing.approved3d,
    },
  });

  return ok({
    draftId: updated.id,
    savedAt: updated.updatedAt,
    warnings: [],
  });
}
