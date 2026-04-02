import { test, expect } from "@playwright/test";

test("hacer click en idioma lleva a su grupo", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("materia-I2201").click();

  await expect(page.getByTestId("grupo-I2201")).toBeVisible();
});