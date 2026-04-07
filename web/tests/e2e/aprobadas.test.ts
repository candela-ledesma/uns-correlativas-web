import { test, expect, type Page, type Locator } from "@playwright/test";

const PLAN_URL = "/planes/lic_computacion";

async function resetEstado(page: Page) {
  await page.goto(PLAN_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

function materia(page: Page, id: string): Locator {
  return page.getByTestId(`materia-${id}`);
}

async function marcarCursada(card: Locator) {
  await card.click();
  await expect(card).toHaveAttribute("data-estado", "cursada");
}

async function marcarAprobada(card: Locator) {
  await card.click();
  await expect(card).toHaveAttribute("data-estado", "cursada");
  await card.click();
  await expect(card).toHaveAttribute("data-estado", "aprobada");
}

test.beforeEach(async ({ page }) => {
  await resetEstado(page);
});

test("una materia aprobada queda aprobada y deshabilitada", async ({ page }) => {
  const rpa = materia(page, "5793");

  await marcarAprobada(rpa);

  await expect(rpa).toHaveAttribute("data-estado", "aprobada");
  await expect(rpa).toBeDisabled();
});

test("IPOO no puede pasar a aprobada si RPA y Elementos no están aprobadas", async ({ page }) => {
  const rpa = materia(page, "5793");
  const algebra = materia(page, "5912");
  const ipoo = materia(page, "7713");

  await marcarCursada(rpa);
  await marcarCursada(algebra);

  await ipoo.click();
  await expect(ipoo).toHaveAttribute("data-estado", "cursada");

  await ipoo.click();
  await expect(ipoo).toHaveAttribute("data-estado", "cursada");
});

test("IPOO puede pasar a aprobada cuando RPA y Elementos están aprobadas", async ({ page }) => {
  const rpa = materia(page, "5793");
  const algebra = materia(page, "5912");
  const ipoo = materia(page, "7713");

  await marcarAprobada(rpa);
  await marcarAprobada(algebra);

  await ipoo.click();
  await expect(ipoo).toHaveAttribute("data-estado", "cursada");

  await ipoo.click();
  await expect(ipoo).toHaveAttribute("data-estado", "aprobada");
});

test("una materia aprobada queda deshabilitada para nuevos clicks", async ({ page }) => {
  const rpa = materia(page, "5793");

  await marcarAprobada(rpa);

  await expect(rpa).toBeDisabled();
});

test("una materia bloqueada no cambia de estado al hacer click", async ({ page }) => {
  const tc = materia(page, "7949"); // Teoría de la Computabilidad

  await expect(tc).toHaveAttribute("data-estado", "no_cursada");
  await expect(tc).toBeDisabled();
});

test("una materia disponible pasa a cursada", async ({ page }) => {
  const algebra = materia(page, "5912");

  await algebra.click();

  await expect(algebra).toHaveAttribute("data-estado", "cursada");
});

test("el estado de una materia persiste al recargar la página", async ({ page }) => {
  const algebra = materia(page, "5912");

  await algebra.click();
  await expect(algebra).toHaveAttribute("data-estado", "cursada");

  await page.reload();

  await expect(algebra).toHaveAttribute("data-estado", "cursada");
});

test("reiniciar progreso limpia los estados", async ({ page }) => {
  const algebra = materia(page, "5912");
  const rpa = materia(page, "5793");

  await marcarAprobada(algebra);
  await marcarAprobada(rpa);

  await page.getByRole("button", { name: /reiniciar progreso/i }).click();

  await expect(algebra).toHaveAttribute("data-estado", "no_cursada");
  await expect(rpa).toHaveAttribute("data-estado", "no_cursada");
});


