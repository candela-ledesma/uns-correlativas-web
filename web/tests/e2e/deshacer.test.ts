import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";

test("deshacer revierte el ultimo cambio de estado", async ({ page }) => {
  await gotoArquitectura(page);

  const materia = page.getByTestId("materia-8118");
  const undoBtn = page.getByTestId("materia-8118-undo");

  await expect(undoBtn).toHaveCount(0);
  await expect(materia).toHaveAttribute("data-estado", "no_cursada");

  await materia.click();
  await expect(materia).toHaveAttribute("data-estado", "cursada");

  await materia.hover();
  await expect(undoBtn).toBeVisible();

  await undoBtn.click();

  await expect(materia).toHaveAttribute("data-estado", "no_cursada");
  await expect(undoBtn).toHaveCount(0);
});
