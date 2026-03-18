export type CatalogProductSeed = {
  slug: string;
  name: string;
};

export type CatalogColorSeed = {
  code: string;
  name: string;
};

export type CatalogSizeCode = "S" | "M" | "L" | "XL";

export type CatalogPrintAreaSeed = {
  code: "front" | "back";
  addonPriceInr: number;
  textureSlot: string;
};

export const CATALOG_PRODUCT_TYPES: CatalogProductSeed[] = [{ slug: "shirt", name: "T-Shirt" }];

export const CATALOG_COLORS: CatalogColorSeed[] = [
  { code: "#F5F5F5", name: "White" },
  { code: "#111111", name: "Black" },
  { code: "#2D6A4F", name: "Green" },
  { code: "#7A1C1C", name: "Red" },
];

export const CATALOG_SIZES: CatalogSizeCode[] = ["S", "M", "L", "XL"];

export const CATALOG_SIZE_MULTIPLIER: Record<CatalogSizeCode, number> = {
  S: 0,
  M: 50,
  L: 100,
  XL: 150,
};

export const CATALOG_BASE_PRICE_BY_SLUG: Record<string, number> = {
  shirt: 699,
};

export const CATALOG_PRINT_AREAS: CatalogPrintAreaSeed[] = [
  { code: "front", addonPriceInr: 0, textureSlot: "front" },
  { code: "back", addonPriceInr: 99, textureSlot: "back" },
];

export const DEFAULT_FLAT_SHIPPING_INR = 99;
export const DEFAULT_AUTOSAVE_MS = 10_000;
