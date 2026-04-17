import { describe, expect, it } from "vitest";
import { hasRequiredRole, isRole, normalizeReason } from "@/lib/authz";

describe("authz", () => {
  it("evalua jerarquia de roles", () => {
    expect(hasRequiredRole("ADMIN", "USER")).toBe(true);
    expect(hasRequiredRole("MODERATOR", "USER")).toBe(true);
    expect(hasRequiredRole("USER", "MODERATOR")).toBe(false);
  });

  it("valida strings de rol", () => {
    expect(isRole("USER")).toBe(true);
    expect(isRole("MODERATOR")).toBe(true);
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("ROOT")).toBe(false);
  });

  it("normaliza motivo", () => {
    expect(normalizeReason("  motivo ")).toBe("motivo");
    expect(normalizeReason("   ")).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
  });
});
