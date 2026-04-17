import { test, expect } from "@playwright/test";

test("cambio de versión conserva estado separado por version_id", async ({ page }) => {
  await page.goto("/planes/arquitectura?v=v2");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const materiaV2 = page.getByTestId("materia-8118");

  await materiaV2.click();
  await expect(materiaV2).toHaveAttribute("data-estado", "cursada");

  await page.goto("/planes/arquitectura?v=v2_interna");
  const materiaV2Interna = page.getByTestId("materia-8118");

  await expect(materiaV2Interna).toHaveAttribute("data-estado", "no_cursada");

  await materiaV2Interna.click();
  await materiaV2Interna.click();
  await expect(materiaV2Interna).toHaveAttribute("data-estado", "aprobada");

  await page.goto("/planes/arquitectura?v=v2");
  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "cursada"
  );

  const snapshot = await page.evaluate(() => ({
    v2: localStorage.getItem("estadoMaterias::arquitectura::v2"),
    v2Interna: localStorage.getItem("estadoMaterias::arquitectura::v2_interna"),
  }));

  expect(snapshot.v2).toContain('"8118":"cursada"');
  expect(snapshot.v2Interna).toContain('"8118":"aprobada"');
});

test("la migración legacy ocurre una sola vez", async ({ page }) => {
  await page.goto("/planes/arquitectura?v=v2");

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("estadoMaterias", JSON.stringify({ "8118": "aprobada" }));
  });

  await page.reload();
  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "aprobada"
  );

  const firstSnapshot = await page.evaluate(() => ({
    legacy: localStorage.getItem("estadoMaterias"),
    versioned: localStorage.getItem("estadoMaterias::arquitectura::v2"),
  }));

  expect(firstSnapshot.legacy).toBeNull();
  expect(firstSnapshot.versioned).toContain('"8118":"aprobada"');

  await page.evaluate(() => {
    localStorage.setItem("estadoMaterias", JSON.stringify({ "8118": "cursada" }));
  });

  await page.reload();
  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "aprobada"
  );

  const secondSnapshot = await page.evaluate(() => ({
    legacy: localStorage.getItem("estadoMaterias"),
    versioned: localStorage.getItem("estadoMaterias::arquitectura::v2"),
  }));

  expect(secondSnapshot.versioned).toContain('"8118":"aprobada"');
  expect(secondSnapshot.legacy).toContain('"8118":"cursada"');
});

test("datos inválidos muestran feedback claro sin romper la pantalla", async ({ page }) => {
  await page.goto("/planes/arquitectura?v=v_invalid_shape");

  await expect(page.getByTestId("plan-status-invalid")).toBeVisible();
  await expect(page.getByText(/formato inválido/i)).toBeVisible();
  await expect(page.getByText(/detalle técnico/i)).toBeVisible();
});
