import { expect, Page } from "@playwright/test";

export async function dismissOnboardingIfPresent(page: Page) {
    const modal = page.getByTestId("plan-onboarding-modal");

    try {
        await modal.waitFor({ state: "visible", timeout: 1500 });
    } catch {
        return;
    }

    await page.getByTestId("plan-onboarding-dismiss").click();
    await expect(modal).toBeHidden();
}

export async function gotoPlan(page: Page, carreraId: string) {
    await page.addInitScript(() => {
        window.localStorage.setItem("onboarding::guest::state", "dismiss");
    });

    await page.goto(`/planes/${carreraId}`);
    await dismissOnboardingIfPresent(page);
}

export async function gotoArquitectura(page: Page) {
    await gotoPlan(page, "arquitectura");
}