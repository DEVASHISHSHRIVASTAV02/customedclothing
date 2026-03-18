import type { AreaKey } from "@/lib/constants";

export function mergeDraftAreaData(
  current: Partial<Record<AreaKey, unknown>>,
  incoming: Partial<Record<AreaKey, unknown>>,
) {
  return {
    ...current,
    ...incoming,
  };
}

