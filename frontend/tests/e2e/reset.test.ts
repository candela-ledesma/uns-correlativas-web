import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";

test("reset limpia los estados", async ({ page }) => {
  await gotoArquitectura(page);

  const materia = page.getByTestId("materia-8118");
  const resetBtn = page.getByTestId("reset-btn");

  await materia.click();
  await materia.click();

  await expect(materia).toHaveAttribute("data-estado", "aprobada");

  await resetBtn.click();
  await page.getByTestId("reset-confirm-btn").click();

  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "no_cursada"
  );
});