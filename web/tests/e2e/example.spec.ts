import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";

test("la página carga correctamente", async ({ page }) => {
  await gotoArquitectura(page);

  await expect(
    page.getByRole("heading", { name: /arquitectura/i, level: 1 })
  ).toBeVisible();

  await expect(page.getByText(/plan universidad nacional del sur/i)).toBeVisible();
});