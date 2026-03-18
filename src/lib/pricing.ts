import type { PrintArea } from "@prisma/client";
import { AREA_KEY_TO_CODE, type AreaKey } from "@/lib/constants";

export type PricingInput = {
  basePriceInr: number;
  selectedAreas: AreaKey[];
  printAreas: Pick<PrintArea, "code" | "addonPriceInr">[];
  designEditPricePerItemInr?: number;
  quantity: number;
  shippingInr: number;
};

export type PricingBreakdown = {
  areaAddonTotalInr: number;
  designEditPricePerItemInr: number;
  lineSubtotalInr: number;
  subtotalInr: number;
  shippingInr: number;
  totalInr: number;
};

export function calculatePricing(input: PricingInput): PricingBreakdown {
  const selectedCodes = new Set(input.selectedAreas.map((area) => AREA_KEY_TO_CODE[area]));

  const perItemAddonTotal = input.printAreas
    .filter((area) => selectedCodes.has(area.code))
    .reduce((sum, area) => sum + area.addonPriceInr, 0);
  const designEditPricePerItemInr = Math.max(0, Math.floor(input.designEditPricePerItemInr ?? 0));

  const lineSubtotalInr = (input.basePriceInr + perItemAddonTotal + designEditPricePerItemInr) * input.quantity;
  const subtotalInr = lineSubtotalInr;
  const totalInr = subtotalInr + input.shippingInr;

  return {
    areaAddonTotalInr: perItemAddonTotal,
    designEditPricePerItemInr,
    lineSubtotalInr,
    subtotalInr,
    shippingInr: input.shippingInr,
    totalInr,
  };
}

