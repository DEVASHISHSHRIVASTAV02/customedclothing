import { describe, expect, it } from "vitest";
import { calculatePricing } from "@/lib/pricing";

describe("calculatePricing", () => {
  it("adds print-area add-ons, quantity, and flat shipping", () => {
    const result = calculatePricing({
      basePriceInr: 800,
      selectedAreas: ["front", "back"],
      printAreas: [
        { code: "FRONT", addonPriceInr: 0 },
        { code: "BACK", addonPriceInr: 99 },
      ] as never,
      quantity: 2,
      shippingInr: 99,
    });

    expect(result.areaAddonTotalInr).toBe(99);
    expect(result.designEditPricePerItemInr).toBe(0);
    expect(result.lineSubtotalInr).toBe(1798);
    expect(result.totalInr).toBe(1897);
  });

  it("adds step 3/4/5 design edit pricing per item", () => {
    const result = calculatePricing({
      basePriceInr: 800,
      selectedAreas: ["front"],
      printAreas: [
        { code: "FRONT", addonPriceInr: 49 },
      ] as never,
      designEditPricePerItemInr: 250,
      quantity: 2,
      shippingInr: 99,
    });

    expect(result.areaAddonTotalInr).toBe(49);
    expect(result.designEditPricePerItemInr).toBe(250);
    expect(result.lineSubtotalInr).toBe(2198);
    expect(result.totalInr).toBe(2297);
  });
});

