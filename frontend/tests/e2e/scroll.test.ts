import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";

test("hacer click en idioma lleva a su grupo", async ({ page }) => {
  await gotoArquitectura(page);

  await page.getByTestId("materia-I2201").click();

  await expect(page.locator("#grupo-I2201")).toBeInViewport();
});