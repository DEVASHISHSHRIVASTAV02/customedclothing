import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { getCatalogColorOrder, normalizeCatalogColor } from "@/lib/color-catalog";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { updateCatalogSchema } from "@/lib/validation";

export async function GET() {
  const guard = await requireAdminApi();
  if (guard.response) {
    return guard.response;
  }

  const [productTypes, variants, printAreas, config] = await Promise.all([
    prisma.productType.findMany({ orderBy: { name: "asc" } }),
    prisma.productVariant.findMany({
      orderBy: [{ productTypeId: "asc" }, { colorName: "asc" }, { sizeCode: "asc" }],
    }),
    prisma.printArea.findMany({
      orderBy: [{ productTypeId: "asc" }, { code: "asc" }],
    }),
    prisma.shopConfig.findUnique({ where: { id: "default" } }),
  ]);
  const normalizedVariants = variants
    .map((variant) => {
      const normalizedColor = normalizeCatalogColor({
        colorCode: variant.colorCode,
        colorName: variant.colorName,
      });

      return {
        ...variant,
        colorCode: normalizedColor.colorCode,
        colorName: normalizedColor.colorName,
      };
    })
    .sort((left, right) => {
      const colorDelta = getCatalogColorOrder(left.colorName, left.colorCode) - getCatalogColorOrder(right.colorName, right.colorCode);
      if (colorDelta !== 0) {
        return colorDelta;
      }
      return left.sizeCode.localeCompare(right.sizeCode);
    });

  return ok({
    productTypes,
    variants: normalizedVariants,
    printAreas,
    config: config ?? { flatShippingInr: 99, autosaveMs: 10000 },
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminApi();
  if (guard.response) {
    return guard.response;
  }

  const json = await request.json().catch(() => null);
  const parsed = updateCatalogSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid catalog update payload.", 400, { issues: parsed.error.flatten() });
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.flatShippingInr !== undefined) {
      await tx.shopConfig.upsert({
        where: { id: "default" },
        update: { flatShippingInr: parsed.data.flatShippingInr },
        create: { id: "default", flatShippingInr: parsed.data.flatShippingInr, autosaveMs: 10000 },
      });
    }

    if (parsed.data.variants?.length) {
      await Promise.all(
        parsed.data.variants.map((variant) =>
          tx.productVariant.update({
            where: { id: variant.id },
            data: {
              basePriceInr: variant.basePriceInr,
              active: variant.active,
            },
          }),
        ),
      );
    }

    if (parsed.data.printAreas?.length) {
      await Promise.all(
        parsed.data.printAreas.map((area) =>
          tx.printArea.update({
            where: { id: area.id },
            data: { addonPriceInr: area.addonPriceInr },
          }),
        ),
      );
    }
  });

  return ok({ success: true });
}

