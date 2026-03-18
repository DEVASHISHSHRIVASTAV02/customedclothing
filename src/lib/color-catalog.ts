type CatalogColor = {
  code: string;
  name: string;
};

export const CATALOG_CANONICAL_COLORS: CatalogColor[] = [
  { code: "#F5F5F5", name: "White" },
  { code: "#111111", name: "Black" },
  { code: "#2D6A4F", name: "Green" },
  { code: "#7A1C1C", name: "Red" },
];

const CANONICAL_BY_CODE = new Map(CATALOG_CANONICAL_COLORS.map((color) => [color.code, color]));
const ORDER_BY_NAME = new Map(CATALOG_CANONICAL_COLORS.map((color, index) => [color.name.toLowerCase(), index]));

const COLOR_CODE_ALIAS: Record<string, string> = {
  "#ffffff": "#F5F5F5",
  "#f5f5f5": "#F5F5F5",
  "#000000": "#111111",
  "#111111": "#111111",
  "#123a68": "#111111",
  "#2d6a4f": "#2D6A4F",
  "#7a1c1c": "#7A1C1C",
};

const COLOR_NAME_ALIAS: Record<string, string> = {
  white: "#F5F5F5",
  cloud: "#F5F5F5",
  black: "#111111",
  obsidian: "#111111",
  navy: "#111111",
  green: "#2D6A4F",
  forest: "#2D6A4F",
  red: "#7A1C1C",
  maroon: "#7A1C1C",
};

function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function normalizeCatalogColorCode(colorCode?: string | null) {
  if (typeof colorCode !== "string") {
    return colorCode ?? "";
  }

  const normalizedHex = normalizeHex(colorCode);
  if (!normalizedHex) {
    return colorCode.trim().toUpperCase();
  }

  return COLOR_CODE_ALIAS[normalizedHex] ?? normalizedHex.toUpperCase();
}

export function normalizeCatalogColorName(colorName?: string | null, colorCode?: string | null) {
  const normalizedCode = normalizeCatalogColorCode(colorCode);
  const fromCode = CANONICAL_BY_CODE.get(normalizedCode);
  if (fromCode) {
    return fromCode.name;
  }

  if (typeof colorName === "string") {
    const trimmed = colorName.trim();
    if (trimmed.length > 0) {
      const aliasKey = trimmed.toLowerCase();
      const mappedCode = COLOR_NAME_ALIAS[aliasKey];
      if (mappedCode) {
        return CANONICAL_BY_CODE.get(mappedCode)?.name ?? trimmed;
      }
      return trimmed;
    }
  }

  return "Black";
}

export function normalizeCatalogColor({
  colorCode,
  colorName,
}: {
  colorCode?: string | null;
  colorName?: string | null;
}) {
  const normalizedCode = normalizeCatalogColorCode(colorCode);
  const normalizedName = normalizeCatalogColorName(colorName, normalizedCode);

  return {
    colorCode: normalizedCode,
    colorName: normalizedName,
  };
}

export function getCatalogColorOrder(colorName: string, colorCode?: string | null) {
  const normalizedName = normalizeCatalogColorName(colorName, colorCode).toLowerCase();
  return ORDER_BY_NAME.get(normalizedName) ?? Number.MAX_SAFE_INTEGER;
}

