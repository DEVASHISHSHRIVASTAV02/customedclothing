import { prisma } from "@/lib/prisma";
import { AREA_CODE_TO_KEY } from "@/lib/constants";
import { getCatalogColorOrder, normalizeCatalogColor } from "@/lib/color-catalog";
import { ok } from "@/lib/http";

export async function GET() {
  const [productTypes, shopConfig] = await Promise.all([
    prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        variants: {
          where: { active: true },
          orderBy: [{ colorName: "asc" }, { sizeCode: "asc" }],
        },
        printAreas: {
          orderBy: { code: "asc" },
        },
      },
    }),
    prisma.shopConfig.findUnique({ where: { id: "default" } }),
  ]);

  const payload = productTypes.map((type) => {
    const normalizedVariants = type.variants
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

    const colors = Array.from(
      new Map(normalizedVariants.map((variant) => [variant.colorCode, { code: variant.colorCode, name: variant.colorName }])).values(),
    );

    const sizes = Array.from(new Set(normalizedVariants.map((variant) => variant.sizeCode)));

    return {
      id: type.id,
      slug: type.slug,
      name: type.name,
      colors,
      sizes,
      variants: normalizedVariants,
      printAreas: type.printAreas.map((area) => ({
        id: area.id,
        code: AREA_CODE_TO_KEY[area.code],
        addonPriceInr: area.addonPriceInr,
        textureSlot: area.textureSlot,
      })),
    };
  });

  return ok({
    currency: "INR",
    products: payload,
    config: {
      flatShippingInr: shopConfig?.flatShippingInr ?? 99,
      autosaveMs: shopConfig?.autosaveMs ?? 10000,
    },
  });
}

