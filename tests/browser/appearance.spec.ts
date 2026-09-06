import { test, expect } from "@playwright/test";
import { APPEARANCE_STORAGE_KEY } from "../../lib/appearance";

test("System follows the device, explicit choices persist, and tabs stay in sync", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  const control = page.getByRole("combobox", { name: "Appearance", exact: true });
  await expect(control).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await control.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(control).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await other.goto("/login");
  await expect(other.getByRole("combobox", { name: "Appearance", exact: true })).toHaveValue("dark");
  await control.selectOption("light");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(other.getByRole("combobox", { name: "Appearance", exact: true })).toHaveValue("light");
  await control.selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

test("stored appearance paints correctly without waiting for application hydration", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(key => localStorage.setItem(key, "dark"), APPEARANCE_STORAGE_KEY);
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, route => route.abort());
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".login-form-panel")).toHaveCSS("background-color", "rgb(27, 31, 39)");
});

test("appearance remains usable when storage is unavailable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Fictional storage restriction"); };
    Storage.prototype.setItem = () => { throw new Error("Fictional storage restriction"); };
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Appearance", exact: true })).toHaveValue("system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
