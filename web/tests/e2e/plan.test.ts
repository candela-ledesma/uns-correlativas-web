import { test, expect } from "@playwright/test";

test("una materia cambia de estado al hacer click", async ({ page }) => {
    await page.goto("/");

    const materia = page.getByTestId("materia-8118");

    await expect(materia).toHaveAttribute("data-estado", "no_cursada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "cursada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "aprobada");

    await materia.click();
    await expect(materia).toHaveAttribute("data-estado", "no_cursada");
});