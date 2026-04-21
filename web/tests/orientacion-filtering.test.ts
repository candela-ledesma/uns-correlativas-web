import { describe, expect, test } from "vitest";

import ingCivil from "@/data/ing_civil.json";
import type { Agrupador, Materia } from "@/app/types/plan";
import { filtrarMaterias, type FiltrosPlan } from "@/lib/filtrarMaterias";

const materias = ingCivil.materias as Materia[];
const agrupadores = ingCivil.agrupadores as Agrupador[];
const idsAgrupadores = new Set(agrupadores.map((agrupador) => String(agrupador.id)));

const filtrosBase: FiltrosPlan = {
  codigo: "",
  anio: "todos",
  cuatrimestre: "todos",
  estado: "todas",
  orientacion: "todas",
};

function orientacionesMateria(materia: Materia) {
  const orientaciones = new Set<string>();

  if (typeof materia.orientacion === "string" && materia.orientacion.trim().length > 0) {
    orientaciones.add(materia.orientacion.trim());
  }

  if (Array.isArray(materia.orientaciones)) {
    materia.orientaciones.forEach((orientacion) => {
      if (typeof orientacion === "string" && orientacion.trim().length > 0) {
        orientaciones.add(orientacion.trim());
      }
    });
  }

  return orientaciones;
}

function filtrarPorOrientacion(orientacion: string) {
  return filtrarMaterias({
    materias,
    estados: {},
    agrupadores,
    idsAgrupadores,
    filtros: {
      ...filtrosBase,
      orientacion,
    },
  });
}

describe("Filtro de orientación con ing_civil.json", () => {
  test("Hidráulica incluye materias hidráulicas esperadas y excluye Construcciones/Vías exclusivas", () => {
    const resultado = filtrarPorOrientacion("Hidráulica");
    const ids = new Set(resultado.map((materia) => String(materia.id)));

    expect(ids.has("5220")).toBe(true);
    expect(ids.has("5335")).toBe(true);
    expect(ids.has("5115")).toBe(true);
    expect(ids.has("5229")).toBe(true);
    expect(ids.has("5013")).toBe(true);

    expect(ids.has("5009")).toBe(false);
    expect(ids.has("5411")).toBe(false);
    expect(ids.has("5180")).toBe(false);
    expect(ids.has("5041")).toBe(false);
    expect(ids.has("5042")).toBe(false);
  });

  test("Vías de Comunicación no mezcla materias exclusivas de Hidráulica", () => {
    const resultado = filtrarPorOrientacion("Vías de Comunicación");
    const ids = new Set(resultado.map((materia) => String(materia.id)));

    expect(ids.has("5180")).toBe(true);
    expect(ids.has("5041")).toBe(true);
    expect(ids.has("5042")).toBe(true);
    expect(ids.has("5013")).toBe(true);

    expect(ids.has("5220")).toBe(false);
    expect(ids.has("5335")).toBe(false);
    expect(ids.has("5115")).toBe(false);
    expect(ids.has("5229")).toBe(false);
  });

  test("Toda materia orientada visible en Hidráulica declara esa orientación", () => {
    const resultado = filtrarPorOrientacion("Hidráulica");

    resultado.forEach((materia) => {
      const orientaciones = orientacionesMateria(materia);
      if (orientaciones.size === 0) {
        return;
      }

      expect(orientaciones.has("Hidráulica")).toBe(true);
    });
  });
});
