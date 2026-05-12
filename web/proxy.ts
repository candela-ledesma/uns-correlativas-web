import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas accesibles solo por ADMIN
const ADMIN_ONLY_PATHS = [
  "/api/admin/planes/guardar",
  "/api/admin/config",
  "/api/admin/users",
];

// Rutas accesibles por ADMIN o MODERATOR
const ADMIN_OR_MODERATOR_PATHS = ["/admin", "/api/admin"];

function pathMatches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role as string | undefined;

  if (pathMatches(pathname, ADMIN_ONLY_PATHS) && role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathMatches(pathname, ADMIN_OR_MODERATOR_PATHS) && role !== "ADMIN" && role !== "MODERATOR") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/perfil/:path*", "/admin/:path*", "/api/admin/:path*", "/moderacion/:path*"],
};
