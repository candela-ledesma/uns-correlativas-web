import type { Session } from "next-auth";
import { auth } from "@/auth";
import { Role, type AppRole } from "@/lib/auth/roles";
import { NextResponse } from "next/server";

const ROLE_WEIGHT: Record<AppRole, number> = {
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

type AuthedSession = Session & { user: NonNullable<Session["user"]> & { id: string } };

export async function requireAdmin(): Promise<AuthedSession | NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session as AuthedSession;
}

export async function requireAdminOrModerator(): Promise<AuthedSession | NextResponse> {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session as AuthedSession;
}

// Para rutas que respetan el rol efectivo (effectiveRole en JWT, usado en /admin/config)
export async function requireAdminReal(): Promise<AuthedSession | NextResponse> {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== Role.ADMIN && (session.user as Record<string, unknown>).realRole !== Role.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session as AuthedSession;
}

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
