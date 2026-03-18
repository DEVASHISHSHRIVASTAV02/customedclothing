import { describe, expect, it } from "vitest";
import { mergeDraftAreaData } from "@/lib/draft-merge";

describe("mergeDraftAreaData", () => {
  it("merges incoming area payload over current state", () => {
    const merged = mergeDraftAreaData(
      {
        front: { objects: [1] },
        back: { objects: [2] },
      },
      {
        back: { objects: [3] },
      },
    );

    expect(merged.front).toEqual({ objects: [1] });
    expect(merged.back).toEqual({ objects: [3] });
  });
});

