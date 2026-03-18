import type { AreaKey } from "@/lib/constants";
import {
  CATALOG_BASE_PRICE_BY_SLUG,
  CATALOG_COLORS,
  CATALOG_PRINT_AREAS,
  CATALOG_PRODUCT_TYPES,
  CATALOG_SIZES,
  CATALOG_SIZE_MULTIPLIER,
} from "@/lib/catalog-seed-config";

type FallbackVariant = {
  id: string;
  colorCode: string;
  colorName: string;
  sizeCode: string;
  basePriceInr: number;
};

type FallbackPrintArea = {
  id: string;
  code: AreaKey;
  addonPriceInr: number;
  textureSlot: string;
};

export type FallbackProduct = {
  id: string;
  slug: string;
  name: string;
  variants: FallbackVariant[];
  printAreas: FallbackPrintArea[];
};

function buildFallbackVariants(productSlug: string): FallbackVariant[] {
  const basePrice = CATALOG_BASE_PRICE_BY_SLUG[productSlug] ?? 799;

  return CATALOG_COLORS.flatMap((color) =>
    CATALOG_SIZES.map((size) => ({
      id: `fallback-variant-${productSlug}-${color.code.slice(1).toLowerCase()}-${size.toLowerCase()}`,
      colorCode: color.code,
      colorName: color.name,
      sizeCode: size,
      basePriceInr: basePrice + CATALOG_SIZE_MULTIPLIER[size],
    })),
  );
}

function buildFallbackPrintAreas(productSlug: string): FallbackPrintArea[] {
  return CATALOG_PRINT_AREAS.map((area) => ({
    id: `fallback-area-${productSlug}-${area.code}`,
    code: area.code as AreaKey,
    addonPriceInr: area.addonPriceInr,
    textureSlot: area.textureSlot,
  }));
}

export function getFallbackCatalog(): FallbackProduct[] {
  return CATALOG_PRODUCT_TYPES.map((product) => ({
    id: `fallback-product-${product.slug}`,
    slug: product.slug,
    name: product.name,
    variants: buildFallbackVariants(product.slug),
    printAreas: buildFallbackPrintAreas(product.slug),
  }));
}

export function getFallbackProductBySlug(slug: string) {
  return getFallbackCatalog().find((product) => product.slug === slug);
}

export function getFallbackClothingItems() {
  return CATALOG_PRODUCT_TYPES.map((product) => ({
    slug: product.slug,
    name: product.name,
  }));
}
