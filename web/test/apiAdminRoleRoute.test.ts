import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../app/api/admin/users/[userId]/role/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createAuditEvent } from "@/lib/db/audit";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/audit", () => ({
  createAuditEvent: vi.fn(),
}));

describe("PATCH /api/admin/users/[userId]/role", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "admin-1",
        email: "admin@uns.local",
        role: "ADMIN",
      },
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exige motivo obligatorio", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/u1/role", {
        method: "PATCH",
        body: JSON.stringify({
          role: "MODERATOR",
          reason: "",
        }),
      }),
      { params: Promise.resolve({ userId: "u1" }) }
    );

    expect(response.status).toBe(400);
  });

  it("actualiza rol y audita cuando actor es admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "user@uns.local",
      role: "USER",
    } as never);

    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "u1",
      email: "user@uns.local",
      role: "MODERATOR",
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/u1/role", {
        method: "PATCH",
        body: JSON.stringify({
          role: "MODERATOR",
          reason: "Necesitamos soporte en moderacion",
        }),
      }),
      { params: Promise.resolve({ userId: "u1" }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.role).toBe("MODERATOR");
    expect(createAuditEvent).toHaveBeenCalled();
  });

  it("rechaza actor sin rol admin", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "mod-1",
        email: "mod@uns.local",
        role: "MODERATOR",
      },
    } as never);

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/u1/role", {
        method: "PATCH",
        body: JSON.stringify({
          role: "MODERATOR",
          reason: "test",
        }),
      }),
      { params: Promise.resolve({ userId: "u1" }) }
    );

    expect(response.status).toBe(403);
  });
});
