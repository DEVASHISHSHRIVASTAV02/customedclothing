import { expect, test } from "@playwright/test";

test("full design-to-checkout flow works", async ({ page }) => {
  const uniquePhone = `9${Date.now().toString().slice(-9)}`;

  await page.goto("/");
  await page.getByRole("link", { name: "Start Designing" }).click();
  await expect(page).toHaveURL(/\/customize$/);

  const productLinks = page.locator('a[href^="/customize/"]:has(button)');
  await expect(productLinks.first()).toBeVisible();
  await productLinks.first().click();

  await expect(
    page.getByRole("heading", { name: "Build Your Design" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Draft" })).toBeEnabled({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Next: Step 3" }).click();
  await expect(
    page.getByRole("heading", { name: "Text Controls" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add Text" }).click();

  await page.getByRole("button", { name: "Next: Step 4" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload Image" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next: Step 5" }).click();
  await expect(
    page.getByRole("heading", { name: "Paint Tools" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText("Saved at")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Next: Step 6 Preview" }).click();
  await expect(page).toHaveURL(/\/customize\/[^/]+\/preview\?draftId=/, {
    timeout: 30_000,
  });

  const approveButton = page.getByRole("button", {
    name: "Approve & Continue to Checkout",
  });
  await expect(approveButton).toBeVisible({ timeout: 30_000 });
  await approveButton.click();

  await expect(page).toHaveURL(/\/checkout\?draftId=/, { timeout: 30_000 });

  await page.getByPlaceholder("Full name").fill("Playwright Tester");
  await page
    .getByPlaceholder("Email")
    .fill(`playwright.${Date.now()}@example.com`);
  await page.getByPlaceholder("Phone").fill(uniquePhone);
  await page.getByPlaceholder("Address line 1").fill("123 Test Street");
  await page.getByPlaceholder("Address line 2").fill("Near Test Landmark");
  await page.getByPlaceholder("Landmark").fill("QA Circle");
  await page.getByPlaceholder("City").fill("Bengaluru");
  await page.getByPlaceholder("State").fill("Karnataka");
  await page.getByPlaceholder("PIN Code").fill("560001");

  await page.getByRole("button", { name: "Place COD Order" }).click();

  await expect(page).toHaveURL(/\/order\/confirmation\//, { timeout: 45_000 });
  await expect(
    page.getByRole("heading", { name: "Thank you. Your order is placed." }),
  ).toBeVisible();

  const confirmationText = (await page.locator("body").textContent()) ?? "";
  const orderCodeMatch = confirmationText.match(/CC-\d{8}-\d{6}/);
  expect(
    orderCodeMatch,
    "Expected order code on confirmation page.",
  ).not.toBeNull();
  const orderCode = orderCodeMatch?.[0] as string;

  await page
    .getByRole("main")
    .getByRole("link", { name: "Track Order" })
    .click();
  await expect(page).toHaveURL(/\/track-order$/);

  await page
    .getByPlaceholder("Order ID (e.g. CC-20260222-123456)")
    .fill(orderCode);
  await page.getByPlaceholder("Phone number").fill(uniquePhone);
  await page.getByRole("button", { name: "Track Order" }).click();

  await expect(page.getByText(`Order: ${orderCode}`)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Current Status:")).toBeVisible();
});
