import type { AppRole } from "@/lib/auth/roles";

const ROLE_WEIGHT: Record<AppRole, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

export function hasRequiredRole(userRole: AppRole, requiredRole: AppRole) {
  return ROLE_WEIGHT[userRole] >= ROLE_WEIGHT[requiredRole];
}

export function isRole(value: string): value is AppRole {
  return value === "USER" || value === "MODERATOR" || value === "ADMIN";
}

export function normalizeReason(reason: string | undefined | null) {
  if (!reason) return null;
  const normalized = reason.trim();
  return normalized.length > 0 ? normalized : null;
}
