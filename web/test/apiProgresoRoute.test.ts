import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT, DELETE } from "../app/api/progreso/route";
import { auth } from "@/auth";
import {
  getProgressSnapshot,
  upsertProgressSnapshot,
} from "@/lib/progressRepository";
import { createAuditEvent } from "@/lib/audit";
import { createUserActivity } from "@/lib/userProductContext";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/progressRepository", () => ({
  getProgressSnapshot: vi.fn(),
  upsertProgressSnapshot: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/userProductContext", () => ({
  createUserActivity: vi.fn(),
}));

describe("/api/progreso", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@uns.local",
        role: "USER",
      },
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET retorna snapshot del usuario autenticado", async () => {
    vi.mocked(getProgressSnapshot).mockResolvedValue({
      state: { "8118": "cursada" },
      updatedAt: "2026-04-17T10:00:00.000Z",
    });

    const response = await GET(
      new Request("http://localhost/api/progreso?planId=arquitectura&versionId=v2")
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state["8118"]).toBe("cursada");
    expect(getProgressSnapshot).toHaveBeenCalled();
  });

  it("PUT persiste cuando snapshot local es mas nuevo", async () => {
    vi.mocked(getProgressSnapshot).mockResolvedValue({
      state: { "8118": "cursada" },
      updatedAt: "2026-04-17T09:00:00.000Z",
    });

    const response = await PUT(
      new Request("http://localhost/api/progreso", {
        method: "PUT",
        body: JSON.stringify({
          planId: "arquitectura",
          versionId: "v2",
          state: { "8118": "aprobada" },
          clientUpdatedAt: "2026-04-17T10:00:00.000Z",
          reason: "test update",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe("local");
    expect(upsertProgressSnapshot).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalled();
    expect(createUserActivity).toHaveBeenCalled();
  });

  it("DELETE reinicia estado y audita", async () => {
    vi.mocked(getProgressSnapshot).mockResolvedValue({
      state: { "8118": "aprobada" },
      updatedAt: "2026-04-17T10:00:00.000Z",
    });

    const response = await DELETE(
      new Request("http://localhost/api/progreso", {
        method: "DELETE",
        body: JSON.stringify({
          planId: "arquitectura",
          versionId: "v2",
          reason: "reset test",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state).toEqual({});
    expect(upsertProgressSnapshot).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalled();
    expect(createUserActivity).toHaveBeenCalled();
  });

  it("responde 401 si no hay sesion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await GET(
      new Request("http://localhost/api/progreso?planId=arquitectura&versionId=v2")
    );

    expect(response.status).toBe(401);
  });
});
