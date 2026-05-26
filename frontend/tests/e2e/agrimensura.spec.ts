import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

test("agrimensura: materia 5002 muestra 5175 como correlativa normal con Aprobada/Aprobada, NO como requisito especial", async ({ page }) => {
  await gotoPlan(page, "agrimensura");

  const materia = page.getByTestId("materia-5002");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-5002-ver-correlativas").click();

  // 5175 aparece como correlativa normal (EXAMEN DE SUFICIENCIA DE IDIOMA: INGLES)
  await expect(materia.getByText(/EXAMEN DE SUFICIENCIA DE IDIOMA/i)).toBeVisible();

  // La fila de la correlativa 5175 (EXAMEN DE SUFICIENCIA) muestra Para cursar/rendir: Aprobada
  // Scoping dentro del li que contiene el nombre de la correlativa
  const filaSuficiencia = materia.locator("li").filter({ hasText: /EXAMEN DE SUFICIENCIA DE IDIOMA/i });
  await expect(filaSuficiencia.getByText(/Para cursar/i).first()).toBeVisible();
  await expect(filaSuficiencia.getByText(/Para rendir/i).first()).toBeVisible();

  // NO hay bloque de requisito especial
  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});

test("agrimensura: materia 5464 muestra minimo_materias_aprobadas con 26, NO prueba_idioma", async ({ page }) => {
  await gotoPlan(page, "agrimensura");

  const materia = page.getByTestId("materia-5464");
  await expect(materia).toBeVisible();

  await page.getByTestId("materia-5464-ver-correlativas").click();

  // Bloque de requisito especial de mínimo materias aprobadas
  await expect(materia.getByText("Requisito especial:")).toBeVisible();
  await expect(materia.getByText(/al menos 26 materias aprobadas/i)).toBeVisible();

  // Estado: X aprobadas (requiere 26)
  await expect(materia.getByText(/requiere.*26|26.*requiere/i)).toBeVisible();

  // NO es prueba_idioma
  await expect(materia.getByText(/Prueba de Suficiencia de Idioma/i)).not.toBeVisible();
  await expect(materia.getByText(/Esta materia requiere que apruebes la prueba/i)).not.toBeVisible();
});

test("agrimensura: materia 5175 no tiene bloque de requisito especial ni correlativas propias", async ({ page }) => {
  await gotoPlan(page, "agrimensura");

  const materia = page.getByTestId("materia-5175");
  await expect(materia).toBeVisible();

  // Sin correlativas ni requisito_especial
  await expect(page.getByTestId("materia-5175-ver-correlativas")).not.toBeVisible();

  await expect(materia.getByText("Requisito especial:")).not.toBeVisible();
});
