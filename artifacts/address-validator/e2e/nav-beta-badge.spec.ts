import { test, expect } from "@playwright/test";

test("Beta pill is visible in the site header on the home page", async ({ page }) => {
  await page.goto("/");

  const header = page.locator("header").first();
  await expect(header).toBeVisible();

  const betaBadge = header.getByText("Beta", { exact: true });
  await expect(betaBadge).toBeVisible();
});

test("Beta pill is visible in the site header on the Try API page", async ({ page }) => {
  await page.goto("/try");

  const header = page.locator("header").first();
  const betaBadge = header.getByText("Beta", { exact: true });
  await expect(betaBadge).toBeVisible();
});

test("Beta pill is visible in the site header on the Coverage page", async ({ page }) => {
  await page.goto("/coverage");

  const header = page.locator("header").first();
  const betaBadge = header.getByText("Beta", { exact: true });
  await expect(betaBadge).toBeVisible();
});
