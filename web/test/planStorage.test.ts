import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { loadPlanState, savePlanState } from "@/lib/planStorage";
import type { EstadoMateria } from "@/lib/evaluarCorrelativas";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("planStorage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mantiene estado separado por versión", () => {
    const estadoV2: Record<string, EstadoMateria> = { "8118": "cursada" };
    const estadoV2Interna: Record<string, EstadoMateria> = { "8118": "aprobada" };

    savePlanState("arquitectura", "v2", estadoV2);
    savePlanState("arquitectura", "v2_interna", estadoV2Interna);

    expect(loadPlanState("arquitectura", "v2")).toEqual(estadoV2);
    expect(loadPlanState("arquitectura", "v2_interna")).toEqual(estadoV2Interna);
  });

  it("migra estado legacy al storage versionado por defecto", () => {
    localStorage.setItem("estadoMaterias", JSON.stringify({ "8118": "aprobada" }));

    const loaded = loadPlanState("arquitectura", "v2");

    expect(loaded).toEqual({ "8118": "aprobada" });
    expect(localStorage.getItem("estadoMaterias")).toBeNull();
    expect(localStorage.getItem("estadoMaterias::arquitectura::v2")).toBe(
      JSON.stringify({ "8118": "aprobada" })
    );
  });

  it("solo migra una vez cuando ya existe clave versionada", () => {
    localStorage.setItem("estadoMaterias", JSON.stringify({ "8118": "aprobada" }));

    const firstLoad = loadPlanState("arquitectura", "v2");
    expect(firstLoad).toEqual({ "8118": "aprobada" });

    localStorage.setItem("estadoMaterias", JSON.stringify({ "8118": "cursada" }));

    const secondLoad = loadPlanState("arquitectura", "v2");

    expect(secondLoad).toEqual({ "8118": "aprobada" });
    expect(localStorage.getItem("estadoMaterias")).toBe(
      JSON.stringify({ "8118": "cursada" })
    );
  });
});
