import { describe, expect, it } from "vitest";
import { calculateDesignEditPricePerItemInr, getDesignEditCounts } from "@/lib/design-pricing";

describe("design pricing", () => {
  it("counts text, image, and paint edits from selected areas only", () => {
    const designJsonByArea = {
      front: {
        objects: [
          { name: "__garment_backdrop__", type: "image" },
          { type: "textbox" },
          { type: "image" },
          { type: "path" },
        ],
      },
      back: {
        objects: [
          { type: "textbox" },
          { type: "circle" },
        ],
      },
    };

    const counts = getDesignEditCounts(designJsonByArea, ["front"]);
    expect(counts).toEqual({
      textEdits: 1,
      imageEdits: 1,
      paintEdits: 1,
    });
    expect(calculateDesignEditPricePerItemInr(designJsonByArea, ["front"])).toBe(250);
  });

  it("treats non-text/non-image objects as paint edits", () => {
    const designJsonByArea = {
      front: {
        objects: [
          { type: "rect" },
          { type: "triangle" },
        ],
      },
    };

    const counts = getDesignEditCounts(designJsonByArea, ["front"]);
    expect(counts).toEqual({
      textEdits: 0,
      imageEdits: 0,
      paintEdits: 2,
    });
    expect(calculateDesignEditPricePerItemInr(designJsonByArea, ["front"])).toBe(120);
  });
});
