import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/materias/[carrera]/route";

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  vi.restoreAllMocks();
});

describe("GET /api/materias/[carrera]", () => {
  it("mantiene contrato para un plan valido", async () => {
    env.NODE_ENV = "test";

    const response = await GET(
      new Request("http://localhost/api/materias/arquitectura?v=v1"),
      {
        params: Promise.resolve({ carrera: "arquitectura" }),
      }
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      plan: { plan_id: string; version_id: string };
      materias: unknown[];
      agrupadores: unknown[];
    };

    expect(body.plan.plan_id).toBe("arquitectura");
    expect(body.plan.version_id).toBe("v1");
    expect(Array.isArray(body.materias)).toBe(true);
    expect(Array.isArray(body.agrupadores)).toBe(true);
  });

  it("responde 422 y detalle tecnico en desarrollo para plan invalido", async () => {
    env.NODE_ENV = "development";

    const planDataLoader = await import("@/lib/data/planDataLoader");
    vi.spyOn(planDataLoader, "loadPlanData").mockResolvedValueOnce({
      status: "invalid",
      carrera: { id: "arquitectura", nombre: "Arquitectura" },
      errorKind: "shape",
      issues: [{ kind: "shape", path: "$", message: "JSON inválido" }],
    });

    const response = await GET(
      new Request("http://localhost/api/materias/arquitectura?v=v_invalid_shape"),
      {
        params: Promise.resolve({ carrera: "arquitectura" }),
      }
    );

    expect(response.status).toBe(422);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.error).toBe("El plan tiene un formato inválido");
    expect(body.code).toBe("INVALID_PLAN_SHAPE");
    expect(Array.isArray(body.details)).toBe(true);
  });

  it("oculta detalles internos en produccion", async () => {
    env.NODE_ENV = "production";

    const planDataLoader = await import("@/lib/data/planDataLoader");
    vi.spyOn(planDataLoader, "loadPlanData").mockResolvedValueOnce({
      status: "invalid",
      carrera: { id: "arquitectura", nombre: "Arquitectura" },
      errorKind: "shape",
      issues: [{ kind: "shape", path: "$", message: "JSON inválido" }],
    });

    const response = await GET(
      new Request("http://localhost/api/materias/arquitectura?v=v_invalid_shape"),
      {
        params: Promise.resolve({ carrera: "arquitectura" }),
      }
    );

    expect(response.status).toBe(422);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.error).toBe("El plan tiene un formato inválido");
    expect(body.code).toBe("INVALID_PLAN_SHAPE");
    expect(body.details).toBeUndefined();
  });
});
