import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

// Nota: en Abogacía, I0002 es un agrupador de tipo idioma_grupo (card independiente en el grid).
// Ninguna materia lo tiene como correlativa clave. Los tests verifican
// la estructura real del JSON y la UI generada.

test("abogacia: materia 9023 muestra correlativas normales (9016, 9101), sin requisito especial", async ({ page }) => {
  await gotoPlan(page, "abogacia");

  const materia = page.getByTestId("materia-9023");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-9023-ver-correlativas").click();

  // Correlativas normales presentes
  await expect(materia.getByText(/DERECHO DE FAMILIA Y SUCESIONES/i)).toBeVisible();
  await expect(materia.getByText(/DERECHO DE SOCIEDADES/i)).toBeVisible();

  // Sin requisito especial
  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
});

test("abogacia: materia 9140 muestra minimo_materias_aprobadas (30), sin prueba_idioma", async ({ page }) => {
  await gotoPlan(page, "abogacia");

  const materia = page.getByTestId("materia-9140");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-9140-ver-correlativas").click();

  // Requisito de mínimo materias aprobadas con cantidad 30
  await expect(materia.getByText("Requisito especial:")).toBeVisible();
  await expect(materia.getByText(/al menos 30 materias aprobadas/i)).toBeVisible();

  // Estado: X aprobadas (requiere 30)
  await expect(materia.getByText(/requiere.*30|30.*requiere/i)).toBeVisible();

  // Sin prueba_idioma
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
  await expect(materia.getByText(/Esta materia requiere que apruebes la prueba/i)).not.toBeVisible();
});

test("abogacia: materia 9116 muestra minimo_materias_aprobadas (30), sin prueba_idioma", async ({ page }) => {
  await gotoPlan(page, "abogacia");

  const materia = page.getByTestId("materia-9116");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-9116-ver-correlativas").click();

  // Requisito de mínimo materias aprobadas con cantidad 30
  await expect(materia.getByText("Requisito especial:")).toBeVisible();
  await expect(materia.getByText(/al menos 30 materias aprobadas/i)).toBeVisible();

  // Sin prueba_idioma
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
  await expect(materia.getByText(/Esta materia requiere que apruebes la prueba/i)).not.toBeVisible();
});

test("abogacia: materia 9085 sin correlativas ni requisito especial", async ({ page }) => {
  await gotoPlan(page, "abogacia");

  // 9085 es optativa del grupo G2347 → testId incluye el grupoId como prefijo
  const materia = page.getByTestId("materia-G2347-9085");
  await expect(materia).toBeVisible();

  // Sin correlativas ni requisito_especial: no hay botón "Ver correlativas"
  await expect(page.getByTestId("materia-G2347-9085-ver-correlativas")).not.toBeVisible();

  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});
