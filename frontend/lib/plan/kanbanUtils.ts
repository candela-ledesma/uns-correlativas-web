import type { Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { getEstadoKey } from "@/lib/plan/estadoKey";

export const PALETTE = [
  "#f9c74f", "#f4a261", "#90be6d", "#43aa8b",
  "#577590", "#9d4edd", "#e76f51", "#4cc9f0", "#f72585",
];

export type CuatrSlot = "1" | "2" | "A";

export const SLOT_LABEL: Record<CuatrSlot, string> = {
  "1": "1° Cuatrimestre",
  "2": "2° Cuatrimestre",
  "A": "Anual",
};

const ANIO_ORDER = [
  "Primer Año", "Segundo Año", "Tercer Año",
  "Cuarto Año", "Quinto Año", "Sexto Año",
];

const SLOT_SORT: Record<CuatrSlot, number> = { "1": 0, "2": 1, "A": 2 };

export function anioSortKey(titulo: string): number {
  const idx = ANIO_ORDER.indexOf(titulo);
  return idx === -1 ? ANIO_ORDER.length : idx;
}

export function normalizeCuatrimestre(c: string | null | undefined): CuatrSlot {
  if (!c) return "1";
  const lower = c.toLowerCase();
  if (lower.includes("anual")) return "A";
  if (lower.includes("2") || lower.includes("segundo")) return "2";
  return "1";
}

export function buildInitialOrder(
  materias: Materia[],
  idsAgrupadores: Set<string>,
  agrupadores: Agrupador[] = [],
): Record<string, string[]> {
  const porCol = new Map<string, string[]>();
  const agregados = new Set<string>();

  for (const m of materias) {
    if (m.categoria === "optativa" && m.grupo_opcion && idsAgrupadores.has(String(m.grupo_opcion))) continue;
    const anio = m.año ?? "Sin año";
    const slot = normalizeCuatrimestre(m.cuatrimestre);
    const key  = `${anio}|${slot}`;
    if (!porCol.has(key)) porCol.set(key, []);
    porCol.get(key)!.push(String(m.id));
    agregados.add(String(m.id));
  }

  // Agrupadores con ubicación que no aparecen en materias[] (solo POSITION B)
  for (const ag of agrupadores) {
    const id = String(ag.id);
    if (agregados.has(id) || !ag.año) continue;
    const slot = normalizeCuatrimestre(ag.cuatrimestre);
    const key  = `${ag.año}|${slot}`;
    if (!porCol.has(key)) porCol.set(key, []);
    porCol.get(key)!.push(id);
  }

  // Garantizar que siempre existan slots 1 y 2 para cada año.
  // El slot A se crea solo si hay materias anuales (ya se añadió arriba).
  const years = new Set(Array.from(porCol.keys()).map((k) => k.split("|")[0]));
  for (const y of years) {
    if (!porCol.has(`${y}|1`)) porCol.set(`${y}|1`, []);
    if (!porCol.has(`${y}|2`)) porCol.set(`${y}|2`, []);
  }

  return Object.fromEntries(
    Array.from(porCol.entries()).sort(([a], [b]) => {
      const [ay, ac] = a.split("|");
      const [by, bc] = b.split("|");
      const yearDiff = anioSortKey(ay) - anioSortKey(by);
      if (yearDiff !== 0) return yearDiff;
      return (SLOT_SORT[ac as CuatrSlot] ?? 0) - (SLOT_SORT[bc as CuatrSlot] ?? 0);
    })
  );
}

export function getYearsFromOrder(order: Record<string, string[]>): string[] {
  const years = new Set<string>();
  for (const key of Object.keys(order)) years.add(key.split("|")[0]);
  return Array.from(years).sort((a, b) => {
    const diff = anioSortKey(a) - anioSortKey(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

export function getNextYearName(existingYears: string[]): string {
  for (const name of ANIO_ORDER) {
    if (!existingYears.includes(name)) return name;
  }
  let n = 7;
  while (existingYears.includes(`Año ${n}`)) n++;
  return `Año ${n}`;
}

export function getMateriaEstado(
  materia: Materia,
  estados: Record<string, EstadoMateria>
): EstadoMateria {
  const grupoId = materia.grupo_opcion ?? undefined;
  return estados[getEstadoKey(materia, grupoId)] ?? "no_cursada";
}

export function getMateriaOrientacionKey(m: Materia): string | null {
  if (m.orientacion) return m.orientacion;
  if (m.orientaciones?.length === 1) return m.orientaciones[0];
  return null;
}

export function extractOrientaciones(materias: Materia[], agrupadores: Agrupador[]): string[] {
  const seen   = new Set<string>();
  const result: string[] = [];

  for (const m of materias) {
    const key = getMateriaOrientacionKey(m);
    if (key && !seen.has(key)) { seen.add(key); result.push(key); }
    if (m.orientaciones) {
      for (const ori of m.orientaciones) {
        if (!seen.has(ori)) { seen.add(ori); result.push(ori); }
      }
    }
  }
  for (const a of agrupadores) {
    if (a.orientacion && !seen.has(a.orientacion)) {
      seen.add(a.orientacion); result.push(a.orientacion);
    }
  }

  return result.sort();
}

export function passesOrientationFilter(
  m: Materia,
  selected: string,
  idsAgrupadores: Set<string>,
  agrupadores: Agrupador[],
): boolean {
  if (selected === "todas") return true;
  if (idsAgrupadores.has(String(m.id))) {
    const ag = agrupadores.find((a) => String(a.id) === String(m.id));
    if (ag?.orientacion) return ag.orientacion === selected;
    return true;
  }
  if (m.orientaciones && m.orientaciones.length > 1) {
    return m.orientaciones.includes(selected);
  }
  const key = getMateriaOrientacionKey(m);
  return key === null || key === selected;
}
