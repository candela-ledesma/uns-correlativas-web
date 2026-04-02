import { test, expect } from "@playwright/test";

test("los estados persisten luego de recargar", async ({ page }) => {
  await page.goto("/");

  const materia = page.getByTestId("materia-8118");

  await materia.click();
  await materia.click();

  await expect(materia).toHaveAttribute("data-estado", "aprobada");

  await page.reload();

  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "aprobada"
  );
});