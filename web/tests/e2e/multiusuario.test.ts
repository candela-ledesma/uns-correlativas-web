import { expect, test, type Page } from "@playwright/test";

async function loginDev(
  page: Page,
  options: { email: string; role: "USER" | "MODERATOR" | "ADMIN"; next?: string }
) {
  const next = options.next ?? "/perfil";
  await page.goto(`/login?next=${encodeURIComponent(next)}`);

  await page.getByTestId("dev-login-email").fill(options.email);
  await page.getByTestId("dev-login-role").selectOption(options.role);
  await page.getByTestId("dev-login-submit").click();

  await expect(page).toHaveURL(new RegExp(next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("login de desarrollo + sincronizacion de progreso por usuario", async ({ page }) => {
  const email = `e2e-sync-${Date.now()}@uns.local`;

  await loginDev(page, {
    email,
    role: "USER",
    next: "/planes/arquitectura",
  });

  const materia = page.getByTestId("materia-8118");

  await materia.click();
  await materia.click();

  await expect(materia).toHaveAttribute("data-estado", "aprobada");

  await page.reload();

  await expect(page.getByTestId("materia-8118")).toHaveAttribute(
    "data-estado",
    "aprobada"
  );
});

test("usuario sin permisos recibe acceso denegado en admin", async ({ page }) => {
  const email = `e2e-user-${Date.now()}@uns.local`;

  await loginDev(page, {
    email,
    role: "USER",
    next: "/perfil",
  });

  await page.goto("/admin");

  await expect(page.getByText(/acceso denegado/i)).toBeVisible();
});

test("se genera evento de auditoria al actualizar progreso", async ({ page }) => {
  const email = `e2e-admin-${Date.now()}@uns.local`;

  await loginDev(page, {
    email,
    role: "ADMIN",
    next: "/planes/arquitectura",
  });

  const materia = page.getByTestId("materia-8118");
  await materia.click();

  await expect(materia).toHaveAttribute("data-estado", "cursada");

  await page.waitForTimeout(900);
  await page.goto("/admin");

  await expect(page.getByText("PROGRESS_UPDATED").first()).toBeVisible();
});
