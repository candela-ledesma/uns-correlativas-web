import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/api/materias/[carrera]/route";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("GET /api/materias/[carrera]", () => {
  it("mantiene contrato para un plan valido", async () => {
    process.env.NODE_ENV = "test";

    const response = await GET(
      new Request("http://localhost/api/materias/arquitectura?v=v2"),
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
    expect(body.plan.version_id).toBe("v2");
    expect(Array.isArray(body.materias)).toBe(true);
    expect(Array.isArray(body.agrupadores)).toBe(true);
  });

  it("responde 422 y detalle tecnico en desarrollo para plan invalido", async () => {
    process.env.NODE_ENV = "development";

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
    process.env.NODE_ENV = "production";

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
