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

test("deshacer en correlativa invalida materias dependientes", async ({ page }) => {
  await page.goto("/planes/lic_computacion");

  const rpa = page.getByTestId("materia-5793");
  const algebra = page.getByTestId("materia-5912");
  const ipoo = page.getByTestId("materia-7713");

  await rpa.click();
  await algebra.click();

  await expect(rpa).toHaveAttribute("data-estado", "cursada");
  await expect(algebra).toHaveAttribute("data-estado", "cursada");

  await ipoo.click();
  await expect(ipoo).toHaveAttribute("data-estado", "cursada");

  const undoRpa = page.getByTestId("materia-5793-undo");
  await rpa.hover();
  await expect(undoRpa).toBeVisible();
  await undoRpa.click();

  await expect(rpa).toHaveAttribute("data-estado", "no_cursada");
  await expect(ipoo).toHaveAttribute("data-estado", "no_cursada");
});
