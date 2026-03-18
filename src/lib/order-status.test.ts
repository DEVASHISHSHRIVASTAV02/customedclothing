import { describe, expect, it } from "vitest";
import { canTransitionStatus } from "@/lib/order-status";

describe("canTransitionStatus", () => {
  it("allows linear progress", () => {
    expect(canTransitionStatus("PLACED", "CONFIRMED")).toBe(true);
    expect(canTransitionStatus("CONFIRMED", "PRODUCTION")).toBe(true);
    expect(canTransitionStatus("PRODUCTION", "SHIPPED")).toBe(true);
  });

  it("blocks invalid jumps", () => {
    expect(canTransitionStatus("PLACED", "SHIPPED")).toBe(false);
    expect(canTransitionStatus("DELIVERED", "CONFIRMED")).toBe(false);
  });
});

