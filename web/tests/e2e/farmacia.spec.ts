import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

test("farmacia: materia 1126 muestra I0902 como correlativa normal, NO como requisito especial", async ({ page }) => {
  await gotoPlan(page, "farmacia");

  const materia = page.getByTestId("materia-1126");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-1126-ver-correlativas").click();

  // I0902 aparece como correlativa (por su nombre limpio de agrupador)
  await expect(materia.getByText(/idioma de farmacia/i)).toBeVisible();

  // NO hay bloque de requisito especial
  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
});

test("farmacia: materia 8161 no tiene correlativas ni requisito especial", async ({ page }) => {
  await gotoPlan(page, "farmacia");

  const materia = page.getByTestId("materia-8161");
  await expect(materia).toBeVisible();

  // Sin correlativas ni requisito_especial: el botón "Ver correlativas" no aparece
  await expect(page.getByTestId("materia-8161-ver-correlativas")).not.toBeVisible();

  // No hay bloque de requisito especial
  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});

test("farmacia: materia 4578 no muestra bloque de requisito especial ni correlativas propias", async ({ page }) => {
  await gotoPlan(page, "farmacia");

  // 4578 es optativa del grupo idioma I0902 → testId incluye el grupoId como prefijo
  const materia = page.getByTestId("materia-I0902-4578");
  await expect(materia).toBeVisible();

  // Sin correlativas ni requisito_especial
  await expect(page.getByTestId("materia-I0902-4578-ver-correlativas")).not.toBeVisible();

  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});
