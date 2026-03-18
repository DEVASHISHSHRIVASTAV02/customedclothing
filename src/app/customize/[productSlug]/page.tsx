import { notFound } from "next/navigation";
import { AreaKey, AREA_CODE_TO_KEY, AREA_KEYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getCatalogColorOrder, normalizeCatalogColor } from "@/lib/color-catalog";
import { getFallbackProductBySlug } from "@/lib/fallback-catalog";
import { getDisplayProductName } from "@/lib/product-display";
import { ProductCustomizer } from "@/components/customizer/product-customizer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ productSlug: string }>;
  searchParams: Promise<{ draftId?: string; sessionId?: string; areas?: string; step?: string }>;
};

function parseAreas(raw: string | undefined): AreaKey[] {
  if (!raw) {
    return ["front"];
  }

  const requested = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is AreaKey => AREA_KEYS.includes(value as AreaKey));

  return requested.length ? Array.from(new Set(requested)) : ["front"];
}

function parseStep(raw: string | undefined): 2 | 3 | 4 | 5 {
  const parsed = Number(raw);
  if (parsed >= 2 && parsed <= 5) {
    return parsed as 2 | 3 | 4 | 5;
  }
  return 2;
}

export default async function ProductCustomizePage({ params, searchParams }: PageProps) {
  const [{ productSlug }, search] = await Promise.all([params, searchParams]);

  let productPayload:
    | {
        id: string;
        slug: string;
        name: string;
        variants: Array<{
          id: string;
          colorCode: string;
          colorName: string;
          sizeCode: string;
          basePriceInr: number;
        }>;
        printAreas: Array<{
          id: string;
          code: AreaKey;
          addonPriceInr: number;
          textureSlot: string;
        }>;
      }
    | null = null;

  try {
    const product = await prisma.productType.findUnique({
      where: { slug: productSlug },
      include: {
        variants: {
          where: { active: true },
          orderBy: [{ colorName: "asc" }, { sizeCode: "asc" }],
        },
        printAreas: {
          orderBy: { code: "asc" },
        },
      },
    });

    if (product && product.active && product.variants.length > 0) {
      const variants = product.variants
        .map((variant) => {
          const normalizedColor = normalizeCatalogColor({
            colorCode: variant.colorCode,
            colorName: variant.colorName,
          });

          return {
            id: variant.id,
            colorCode: normalizedColor.colorCode,
            colorName: normalizedColor.colorName,
            sizeCode: variant.sizeCode,
            basePriceInr: variant.basePriceInr,
          };
        })
        .sort((left, right) => {
          const colorDelta = getCatalogColorOrder(left.colorName, left.colorCode) - getCatalogColorOrder(right.colorName, right.colorCode);
          if (colorDelta !== 0) {
            return colorDelta;
          }
          return left.sizeCode.localeCompare(right.sizeCode);
        });

      productPayload = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        variants,
        printAreas: product.printAreas.map((area) => ({
          id: area.id,
          code: AREA_CODE_TO_KEY[area.code],
          addonPriceInr: area.addonPriceInr,
          textureSlot: area.textureSlot,
        })),
      };
    }
  } catch {
    productPayload = null;
  }

  if (!productPayload) {
    const fallbackProduct = getFallbackProductBySlug(productSlug);
    if (fallbackProduct) {
      productPayload = fallbackProduct;
    }
  }

  if (!productPayload) {
    notFound();
  }

  return (
    <div className="w-full min-h-screen">
      <div className="mx-auto w-full max-w-7xl">
        <div className="px-6 pt-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">
            Customize {getDisplayProductName(productPayload.slug, productPayload.name)}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Build Your Design</h1>
        </div>
        <ProductCustomizer
          product={productPayload}
          initialDraftId={search.draftId}
          initialSessionId={search.sessionId}
          initialAreas={parseAreas(search.areas)}
          initialStep={parseStep(search.step)}
        />
      </div>
    </div>
  );
}





