import { test, expect } from "@playwright/test";
import { gotoArquitectura } from "./helpers";

test("una materia avanza de no cursada a cursada y aprobada", async ({ page }) => {
    await gotoArquitectura(page);

    const materia = page.getByTestId("materia-8118");

    await expect(materia).toHaveAttribute("data-estado", "no_cursada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "cursada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "aprobada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "aprobada");
});