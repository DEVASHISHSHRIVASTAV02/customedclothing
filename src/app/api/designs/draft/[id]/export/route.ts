import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AREA_KEYS, type AreaKey } from "@/lib/constants";
import { exportDraftSchema } from "@/lib/validation";
import { buildExportBuffer } from "@/lib/design-export";
import { fail, ok } from "@/lib/http";
import { getCustomerSession } from "@/lib/auth";
import { parseDraftPreviewMap, resolveDraftPreviewSource } from "@/lib/draft-preview-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const customerSession = await getCustomerSession();
  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = exportDraftSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid export payload.", 400, { issues: parsed.error.flatten() });
  }

  const draft = await prisma.designDraft.findUnique({ where: { id } });
  if (!draft) {
    return fail("Draft not found.", 404);
  }

  if (draft.customerId && draft.customerId !== customerSession?.user.id) {
    return fail("You do not have access to this draft.", 403);
  }

  const existingPreviewUrls = parseDraftPreviewMap(draft.previewImageUrls);
  const preparedAreas: AreaKey[] = [];

  for (const area of parsed.data.selectedAreas) {
    if (!AREA_KEYS.includes(area)) {
      continue;
    }

    const providedDataUrl = parsed.data.areaDataUrls?.[area];
    const fallbackDataUrl = existingPreviewUrls[area];
    const source = resolveDraftPreviewSource(providedDataUrl ?? fallbackDataUrl);
    await buildExportBuffer(source);
    preparedAreas.push(area);
  }

  if (preparedAreas.length === 0) {
    return fail("No exportable areas were provided.", 400);
  }

  return ok({
    draftId: id,
    preparedAreas,
  });
}
