import { test, expect, type Page, type Locator } from "@playwright/test";

const PLAN_URL = "/planes/lic_computacion";

async function resetEstado(page: Page) {
  await page.goto(PLAN_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function abrirFiltros(page: Page) {
  const toggle = page.getByTestId("toggle-filtros-btn");
  await expect(toggle).toBeVisible();

  const expandido = await toggle.getAttribute("aria-expanded");
  if (expandido === "true") return;

  await toggle.click();
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

async function filtrarPorEstado(page: Page, estado: string) {
  await abrirFiltros(page);
  await page.getByTestId("filtro-estado").selectOption(estado);
}

async function filtrarPorAnio(page: Page, anio: string) {
  await abrirFiltros(page);
  await page.getByTestId("filtro-anio").selectOption(anio);
}

async function filtrarPorCuatrimestre(page: Page, cuatrimestre: string) {
  await abrirFiltros(page);
  await page.getByTestId("filtro-cuatrimestre").selectOption(cuatrimestre);
}

test.beforeEach(async ({ page }) => {
  await resetEstado(page);
});



test("filtra materias aprobadas", async ({ page }) => {
  const rpa = materia(page, "5793");
  const algebra = materia(page, "5912");

  await marcarAprobada(rpa);
  await marcarCursada(algebra);

  await filtrarPorEstado(page, "aprobadas");

  await expect(rpa).toBeVisible();
  await expect(algebra).not.toBeVisible();
});

test("filtra materias cursadas", async ({ page }) => {
  const rpa = materia(page, "5793");
  const algebra = materia(page, "5912");

  await marcarCursada(rpa);
  await marcarAprobada(algebra);

  await filtrarPorEstado(page, "cursadas");

  await expect(rpa).toBeVisible();
  await expect(algebra).not.toBeVisible();
});

test("filtra materias disponibles", async ({ page }) => {
  await filtrarPorEstado(page, "disponibles");

  await expect(materia(page, "5912")).toBeVisible();
  await expect(materia(page, "5793")).toBeVisible();
  await expect(materia(page, "7713")).not.toBeVisible();
});

test("filtra por año", async ({ page }) => {
  await filtrarPorAnio(page, "Primer Año");

  await expect(page.getByRole("heading", { name: "Primer Año" })).toBeVisible();
  await expect(materia(page, "5912")).toBeVisible();
  await expect(materia(page, "5793")).toBeVisible();

  await expect(materia(page, "7655")).not.toBeVisible();
  await expect(materia(page, "7949")).not.toBeVisible();
});

test("combina filtro por año y estado", async ({ page }) => {
  const rpa = materia(page, "5793");
  const algebra = materia(page, "5912");

  await marcarAprobada(rpa);
  await marcarCursada(algebra);

  await filtrarPorAnio(page, "Primer Año");
  await filtrarPorEstado(page, "aprobadas");

  await expect(rpa).toBeVisible();
  await expect(algebra).not.toBeVisible();
  await expect(materia(page, "7655")).not.toBeVisible();
});

test("filtra por cuatrimestre", async ({ page }) => {
  await filtrarPorCuatrimestre(page, "Primer Cuatrimestre");

  await expect(materia(page, "5912")).toBeVisible();
  await expect(materia(page, "5793")).toBeVisible();

  await expect(materia(page, "5551")).not.toBeVisible();
  await expect(materia(page, "7713")).not.toBeVisible();
});

test("restaura los filtros al estado inicial", async ({ page }) => {
  await filtrarPorAnio(page, "Primer Año");
  await filtrarPorCuatrimestre(page, "Primer Cuatrimestre");
  await filtrarPorEstado(page, "aprobadas");

  await page.getByTestId("reset-filtros-btn").click();

  await expect(page.getByTestId("filtro-anio")).toHaveValue("todos");
  await expect(page.getByTestId("filtro-cuatrimestre")).toHaveValue("todos");
  await expect(page.getByTestId("filtro-estado")).toHaveValue("todas");
});