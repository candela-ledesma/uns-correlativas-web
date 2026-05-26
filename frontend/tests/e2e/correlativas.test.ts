import { test, expect } from "@playwright/test";
import { gotoPlan } from "./helpers";

test("muestra correlativas de una materia al presionar ver correlativas", async ({ page }) => {
  await gotoPlan(page, "lic_computacion");

  const materiaIpoo = page.getByTestId("materia-7713");
  const botonVerCorrelativas = page.getByTestId("materia-7713-ver-correlativas");
  const cardIpoo = page.getByTestId("materia-7713");

  await expect(materiaIpoo).toBeVisible();
  await expect(botonVerCorrelativas).toBeVisible();

  await botonVerCorrelativas.click();

  await expect(page.getByText("RESOLUCION DE PROBLEMAS Y ALGORITMOS (5793)")).toBeVisible();
  await expect(page.getByText("ELEMENTOS DE ALGEBRA Y DE GEOMETRIA (5912)")).toBeVisible();
  await expect(cardIpoo.getByText("No cumple")).toHaveCount(4);
});
