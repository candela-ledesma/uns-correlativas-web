import { test, expect } from "@playwright/test";

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

    await page.goto("/");

    const tallerIV = page.getByTestId("materia-3945");
    await expect(tallerIV).toHaveAttribute("data-habilitada", "no");

    const ingles = page.getByTestId("materia-4804");
    await ingles.click();
    await ingles.click();

    await expect(page.getByTestId("materia-3945")).toHaveAttribute(
    "data-habilitada",
    "si"
    );
});