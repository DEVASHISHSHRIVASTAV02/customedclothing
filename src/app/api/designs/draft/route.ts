import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createDraftSchema } from "@/lib/validation";
import { DRAFT_TTL_DAYS, AREA_CODE_TO_KEY, AUTOSAVE_DEFAULT_MS } from "@/lib/constants";
import { fail, ok } from "@/lib/http";
import { getCustomerSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const customerSession = await getCustomerSession();
  const json = await request.json().catch(() => null);
  const parsed = createDraftSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid draft request payload.", 400, { issues: parsed.error.flatten() });
  }

  if (!customerSession) {
    return fail("Please log in to save drafts.", 401);
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: parsed.data.productVariantId },
    include: {
      productType: {
        include: {
          printAreas: true,
        },
      },
    },
  });

  if (!variant || !variant.active || !variant.productType.active) {
    return fail("Selected product variant is not available.", 404);
  }

  const draft = await prisma.designDraft.create({
    data: {
      sessionId: parsed.data.sessionId,
      customerId: customerSession.user.id,
      savedToAccount: false,
      productVariantId: parsed.data.productVariantId,
      expiresAt: new Date(Date.now() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000),
      designJsonByArea: {},
      previewImageUrls: {},
    },
  });

  const config = await prisma.shopConfig.findUnique({ where: { id: "default" } });

  return ok({
    draftId: draft.id,
    autosaveMs: config?.autosaveMs ?? AUTOSAVE_DEFAULT_MS,
    allowedPrintAreas: variant.productType.printAreas.map((area) => AREA_CODE_TO_KEY[area.code]),
  });
}
