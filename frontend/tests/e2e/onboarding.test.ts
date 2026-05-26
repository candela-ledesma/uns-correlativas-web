import { test, expect } from "@playwright/test";

test("onboarding forzado por query se consume y no reaparece tras refresh", async ({
  page,
}) => {
  await page.goto("/");

  await page.evaluate(() => {
    localStorage.setItem("onboarding::guest::state", "dismiss");
  });

  await page.goto("/planes/arquitectura?onboarding=1");

  const modal = page.getByTestId("plan-onboarding-modal");
  await expect(modal).toBeVisible();

  await page.getByTestId("plan-onboarding-dismiss").click();
  await expect(modal).toBeHidden();

  await expect(page).toHaveURL(/\/planes\/arquitectura$/);

  await page.reload();
  await expect(modal).toBeHidden();
});
