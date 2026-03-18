import { AREA_KEYS, type AreaKey } from "@/lib/constants";

export type DesignJsonByArea = Partial<Record<AreaKey, unknown>>;
export type PreviewImageUrlsByArea = Partial<Record<AreaKey, string>>;

export function normalizeAreaKeys<T>(input: Record<string, T>): Partial<Record<AreaKey, T>> {
  const output: Partial<Record<AreaKey, T>> = {};
  for (const key of AREA_KEYS) {
    if (key in input) {
      output[key] = input[key];
    }
  }
  return output;
}

export function hasAnyAreaValue(input: Partial<Record<AreaKey, unknown>>) {
  return AREA_KEYS.some((area) => Boolean(input[area]));
}

