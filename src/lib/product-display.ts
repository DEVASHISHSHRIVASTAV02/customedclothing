import { CATALOG_PRODUCT_TYPES } from "@/lib/catalog-seed-config";

const PRODUCT_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  CATALOG_PRODUCT_TYPES.map((product) => [product.slug, product.name]),
);

export function getDisplayProductName(slug: string, fallbackName: string) {
  return PRODUCT_NAME_BY_SLUG[slug] ?? fallbackName;
}
