import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { gotoPlan } from "./helpers";

// ── Tipos mínimos del JSON de plan ────────────────────────────────────────────
type Agrupador = {
  id: string;
  nombre: string;
  tipo: string;
  año?: string | null;
  cuatrimestre?: string | null;
  opciones: string[];
};

type PlanJSON = {
  agrupadores?: Agrupador[];
};

// ── Descubrimiento de carreras desde el filesystem ────────────────────────────
const DATA_DIR = join(__dirname, "../../data");

function leerCarreras(): { carreraId: string; agrupadores: Agrupador[] }[] {
  const archivos = readdirSync(DATA_DIR).filter(
    (f) =>
      f.endsWith(".json") &&
      !f.includes("invalid") &&
      !f.includes("arquitectura_")
  );

  return archivos.map((archivo) => {
    const carreraId = archivo.replace(".json", "");
    const raw = JSON.parse(readFileSync(join(DATA_DIR, archivo), "utf-8")) as PlanJSON;
    const agrupadores = (raw.agrupadores ?? []).filter(
      (a) => a.año && a.cuatrimestre
    );
    return { carreraId, agrupadores };
  });
}

const carreras = leerCarreras();

// ── Limpieza de nombre (mismo regex que AgrupadorCard) ────────────────────────
const BASURA_NOMBRE =
  /\s+(Optativa|Idioma|Seminario)\s+Correlativas\s+Para cursar\s+Para rendir\s*$/i;

function limpiarNombre(nombre: string): string {
  return nombre.replace(BASURA_NOMBRE, "").trim();
}

// ── Tests ─────────────────────────────────────────────────────────────────────
for (const { carreraId, agrupadores } of carreras) {
  if (agrupadores.length === 0) {
    // La carrera no tiene agrupadores posicionados en el plan — se saltea.
    test.skip(`${carreraId} — sin agrupadores con ubicación, se saltea`, () => {});
    continue;
  }

  test.describe(`${carreraId} — agrupadores en el plan`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoPlan(page, carreraId);
    });

    for (const agrupador of agrupadores) {
      const { id, nombre, tipo, año, cuatrimestre } = agrupador;
      const nombreLimpio = limpiarNombre(nombre);
      const tipoLabel = tipo === "idioma_grupo"
        ? "idioma"
        : tipo === "seminario_grupo"
          ? "seminario"
          : "optativa";

      test(`${tipoLabel} ${id} aparece como card en ${año} / ${cuatrimestre}`, async ({ page }) => {
        // La card debe existir en el DOM
        const card = page.getByTestId(`agrupador-card-${id}`);
        await expect(card).toBeVisible();

        // El badge "Disponible" debe ser visible dentro de la card
        // (aria-hidden=true, así que usamos text locator dentro de la card)
        await expect(card.locator("span").filter({ hasText: /Disponible|Cursada|Aprobada/ })).toBeVisible();

        // El link "Ver opciones" debe existir y apuntar al ancora correcta
        const link = card.getByRole("link", { name: /ver opciones/i });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", `#grupo-${id}`);

        // La card debe estar dentro de la sección del año correcto
        // Verificamos que el heading del año está visible en la página
        await expect(
          page.getByRole("heading", { level: 2, name: año! })
        ).toBeVisible();

        // El nombre limpio del agrupador debe aparecer en la card
        await expect(card).toContainText(nombreLimpio);
      });
    }
  });
}
