import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";


test("aprobar ingles habilita una materia que depende de idioma", async ({ page }) => {
    await page.addInitScript(() => {
    localStorage.setItem(
        "estadoMaterias",
        JSON.stringify({
        "3751": "aprobada",
        "3820": "aprobada",
        "3944": "aprobada",
        "4607": "aprobada",
        "5076": "aprobada",
        "5205": "aprobada",
        "5287": "aprobada"
        })
    );
    });

    await gotoArquitectura(page);

    const tallerIV = page.getByTestId("materia-3945");
    await expect(tallerIV).toHaveAttribute("data-habilitada", "no");

    const ingles = page.locator('[data-testid$="-4804"]');
    await expect(ingles).toBeVisible();
    await ingles.click();
    await ingles.click();

    await expect(page.getByTestId("materia-3945")).toHaveAttribute(
    "data-habilitada",
    "si"
    );
});

test("muestra puntero de optativas y navega al grupo cuando el cuatrimestre queda sin materias normales", async ({ page }) => {
    await gotoArquitectura(page);

    await page.getByTestId("toggle-filtros-btn").click();
    await page.getByTestId("filtro-anio").selectOption("Quinto Año");
    await page.getByTestId("filtro-cuatrimestre").selectOption("Primer Cuatrimestre");
    await page.getByTestId("filtro-codigo").fill("OPTATIVA ELECTIVA GR1");

    const punteroOptativas = page.getByTestId("puntero-grupo-G2324");
    await expect(punteroOptativas).toBeVisible();

    await punteroOptativas.click();
    await expect(page).toHaveURL(/#grupo-G2324$/);
    await expect(page.locator("#grupo-G2324")).toBeInViewport();
});

test("muestra idioma en el cuatrimestre del agrupador y permite navegar al grupo", async ({ page }) => {
    await gotoArquitectura(page);

    await page.getByTestId("toggle-filtros-btn").click();
    await page.getByTestId("filtro-anio").selectOption("Tercer Año");
    await page.getByTestId("filtro-cuatrimestre").selectOption("Segundo Cuatrimestre");

    const cardIdioma = page.getByTestId("materia-I2201");
    await expect(cardIdioma).toBeVisible();

    await cardIdioma.click();
    await expect(page.locator("#grupo-I2201")).toBeInViewport();
});
