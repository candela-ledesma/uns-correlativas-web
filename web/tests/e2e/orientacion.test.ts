import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

async function dismissOnboarding(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("onboarding::guest::state", "dismiss");
  });
}

test.describe("Ingeniería Civil - orientaciones y correlativas", () => {
  test("Construcciones: aparece 5225 y no aparecen exclusivas de Hidráulica o Vías", async ({ page }) => {
    await dismissOnboarding(page);
    await gotoPlan(page, "ing_civil");

    const opcionConstrucciones = page.getByTestId(
      "orientacion-option-construcciones"
    );

    await opcionConstrucciones.click();

    await expect(opcionConstrucciones).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/orientacion=Construcciones|orientacion=construcciones/);

    // Caso pedido: en Construcciones aparece 5225
    await expect(page.getByTestId("materia-5225")).toBeVisible();
    await expect(page.getByTestId("materia-5013")).toHaveCount(0);

    // No deben aparecer exclusivas de Hidráulica
    await expect(page.getByTestId("materia-5220")).toHaveCount(0);
    await expect(page.getByTestId("materia-5335")).toHaveCount(0);
    await expect(page.getByTestId("materia-5115")).toHaveCount(0);

    // No deben aparecer exclusivas de Vías
    await expect(page.getByTestId("materia-5180")).toHaveCount(0);
    await expect(page.getByTestId("materia-5041")).toHaveCount(0);
    await expect(page.getByTestId("materia-5042")).toHaveCount(0);
  });

  test("Hidráulica: aparecen 5220, 5335 y 5115", async ({ page }) => {
    await dismissOnboarding(page);
    await gotoPlan(page, "ing_civil");

    const opcionHidraulica = page.getByTestId("orientacion-option-hidraulica");

    await opcionHidraulica.click();

    await expect(opcionHidraulica).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("materia-5220")).toBeVisible();
    await expect(page.getByTestId("materia-5335")).toBeVisible();
    await expect(page.getByTestId("materia-5115")).toBeVisible();
    await expect(page.getByTestId("materia-5013")).toHaveCount(0);
  });

  test("Vías de Comunicación: aparecen 5180, 5041 y 5042", async ({ page }) => {
    await dismissOnboarding(page);
    await gotoPlan(page, "ing_civil");

    const opcionVias = page.getByTestId("orientacion-option-vias-de-comunicacion");

    await opcionVias.click();

    await expect(opcionVias).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("materia-5180")).toBeVisible();
    await expect(page.getByTestId("materia-5041")).toBeVisible();
    await expect(page.getByTestId("materia-5042")).toBeVisible();
    await expect(page.getByTestId("materia-5013")).toHaveCount(0);
  });

  test("lee orientación desde query params y permite volver a Todas", async ({ page }) => {
    await dismissOnboarding(page);

    await page.goto("/planes/ing_civil?orientacion=hidraulica");

    const opcionHidraulica = page.getByTestId("orientacion-option-hidraulica");
    const opcionTodas = page.getByTestId("orientacion-option-todas");

    await expect(page.getByTestId("orientacion-selector")).toBeVisible();
    await expect(opcionHidraulica).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("materia-5220")).toBeVisible();
    await expect(page.getByTestId("materia-5180")).toHaveCount(0);

    await opcionTodas.click();

    await expect(opcionTodas).toHaveAttribute("aria-pressed", "true");
    await expect(page).not.toHaveURL(/orientacion=/);

    // Sin filtro, vuelven a aparecer materias de distintas orientaciones
    await expect(page.getByTestId("materia-5220")).toBeVisible();
    await expect(page.getByTestId("materia-5180")).toBeVisible();
    await expect(page.getByTestId("materia-5225")).toBeVisible();
  });

  test("respeta correlativas reales para habilitar ANALISIS MATEMATICO II", async ({ page }) => {
    await dismissOnboarding(page);
    await gotoPlan(page, "ing_civil");

    const algebra = page.getByTestId("materia-5539");
    const analisisI = page.getByTestId("materia-5551");
    const analisisII = page.getByTestId("materia-5552");

    await expect(analisisII).toHaveAttribute("data-habilitada", "no");

    await algebra.click();
    await analisisI.click();

    await expect(algebra).toHaveAttribute("data-estado", "cursada");
    await expect(analisisI).toHaveAttribute("data-estado", "cursada");
    await expect(analisisII).toHaveAttribute("data-habilitada", "si");
  });

});