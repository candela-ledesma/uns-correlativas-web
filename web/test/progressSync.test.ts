import { describe, expect, it } from "vitest";
import {
  resolveProgressSnapshotLww,
  sanitizeProgressState,
} from "@/lib/progressSync";

describe("progressSync", () => {
  it("limpia estados invalidos", () => {
    const sanitized = sanitizeProgressState({
      a: "aprobada",
      b: "cursada",
      c: "no_cursada",
      d: "otro",
      e: 123,
    });

    expect(sanitized).toEqual({
      a: "aprobada",
      b: "cursada",
      c: "no_cursada",
    });
  });

  it("aplica last-write-wins por timestamp", () => {
    const result = resolveProgressSnapshotLww({
      local: {
        state: { "8118": "aprobada" },
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
      remote: {
        state: { "8118": "cursada" },
        updatedAt: "2026-04-17T09:59:00.000Z",
      },
    });

    expect(result.source).toBe("local");
    expect(result.snapshot.state["8118"]).toBe("aprobada");
  });

  it("elige remoto cuando es mas nuevo", () => {
    const result = resolveProgressSnapshotLww({
      local: {
        state: { "8118": "cursada" },
        updatedAt: "2026-04-17T09:00:00.000Z",
      },
      remote: {
        state: { "8118": "aprobada" },
        updatedAt: "2026-04-17T10:00:00.000Z",
      },
    });

    expect(result.source).toBe("remote");
    expect(result.snapshot.state["8118"]).toBe("aprobada");
  });
});
