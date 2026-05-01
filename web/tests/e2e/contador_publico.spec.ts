import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

test("contador_publico: materia 1568 muestra requisito prueba_idioma", async ({ page }) => {
  await gotoPlan(page, "contador_publico");

  const materia = page.getByTestId("materia-1568");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-1568-ver-correlativas").click();

  await expect(materia.getByText("Requisito especial:")).toBeVisible();
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).toBeVisible();
  await expect(materia.getByText(/Esta materia requiere que apruebes la prueba antes de poder calificar/i)).toBeVisible();
});

test("contador_publico: materia 1813 muestra minimo_materias_aprobadas y NO prueba_idioma", async ({ page }) => {
  await gotoPlan(page, "contador_publico");

  const materia = page.getByTestId("materia-1813");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-1813-ver-correlativas").click();

  await expect(materia.getByText("Requisito especial:")).toBeVisible();
  await expect(
    materia.getByText(/materias aprobadas|24 materias/i)
  ).toBeVisible();
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
});

test("contador_publico: materia 4928 NO muestra bloque de requisito especial", async ({ page }) => {
  await gotoPlan(page, "contador_publico");

  const materia = page.getByTestId("materia-4928");
  await expect(materia).toBeVisible();

  // No tiene correlativas ni requisito_especial, por lo que el botón "Ver correlativas" no existe
  await expect(page.getByTestId("materia-4928-ver-correlativas")).not.toBeVisible();

  // Y tampoco hay texto de requisito especial
  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});
