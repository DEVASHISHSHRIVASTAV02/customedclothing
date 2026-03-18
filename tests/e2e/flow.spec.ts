import { test, expect } from "@playwright/test";

test("landing page renders primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start Designing" })).toBeVisible();
});

test("track-order page form is available", async ({ page }) => {
  await page.goto("/track-order");
  await expect(page.getByRole("button", { name: "Track Order" })).toBeVisible();
});
