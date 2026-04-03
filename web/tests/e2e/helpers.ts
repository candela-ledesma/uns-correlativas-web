import { Page } from "@playwright/test";

export async function gotoArquitectura(page: Page) {
    await page.goto("/planes/arquitectura");
}