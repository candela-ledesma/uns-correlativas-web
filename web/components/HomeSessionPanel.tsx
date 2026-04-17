"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import LoginActions from "@/components/LoginActions";

export default function HomeSessionPanel() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 text-center text-sm text-zinc-500 shadow-sm">
        Cargando sesión...
      </div>
    );
  }

  if (status !== "authenticated" || !session.user) {
    return (
      <div className="mx-auto mt-8 max-w-xl">
        <LoginActions callbackUrl="/perfil" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 grid max-w-xl gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left shadow-sm">
      <p className="text-sm text-zinc-700">
        Sesión iniciada como <span className="font-semibold">{session.user.email}</span>
      </p>
      <p className="text-xs text-zinc-500">Rol: {session.user.role}</p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href="/perfil"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
        >
          Ir a perfil
        </Link>
        {(session.user.role === "MODERATOR" || session.user.role === "ADMIN") && (
          <Link
            href="/moderacion"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
          >
            Moderación
          </Link>
        )}
        {session.user.role === "ADMIN" && (
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
          >
            Admin
          </Link>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
