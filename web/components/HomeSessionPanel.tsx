"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import LoginActions from "@/components/LoginActions";
import {
  buildPlanHref,
  type UserProductContextResponse,
} from "@/lib/userProductContextTypes";

export default function HomeSessionPanel() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [userContext, setUserContext] = useState<UserProductContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadUserContext() {
    setContextLoading(true);

    const response = await fetch("/api/perfil/contexto").catch(() => null);

    if (!response?.ok) {
      setContextLoading(false);
      return;
    }

    const payload = (await response.json()) as UserProductContextResponse;
    setUserContext(payload);
    setContextLoading(false);
  }

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setUserContext(null);
      return;
    }

    void loadUserContext();
  }, [status]);

  useEffect(() => {
    if (!open) return;
    if (status !== "authenticated") return;

    void loadUserContext();
  }, [open, status]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  if (status === "loading") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 shadow-sm">
        Cargando sesion...
      </div>
    );
  }

  if (status !== "authenticated" || !session.user) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Iniciar sesion
          <span aria-hidden="true">{open ? "^" : "v"}</span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Acceso"
            className="absolute right-0 z-30 mt-3 w-[min(92vw,430px)] rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl"
            style={{ animation: "dropdownIn 160ms ease-out" }}
          >
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Acceso
            </p>
            <LoginActions callbackUrl="/perfil" compact />
          </div>
        )}
      </div>
    );
  }

  const activeCareerId = userContext?.activeCareerId;
  const activeCareer = activeCareerId
    ? userContext?.careers.find((career) => career.id === activeCareerId)
    : null;
  const activeLastPlan = activeCareerId
    ? userContext?.lastPlanByCareer[activeCareerId]
    : undefined;
  const quickPlanHref = activeCareerId
    ? buildPlanHref(activeCareerId, activeLastPlan)
    : "/";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="max-w-[190px] truncate">{session.user.email}</span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
          {session.user.role}
        </span>
        <span aria-hidden="true">{open ? "^" : "v"}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu de sesion"
          className="absolute right-0 z-30 mt-3 w-[min(92vw,360px)] rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-xl"
          style={{ animation: "dropdownIn 160ms ease-out" }}
        >
          <p className="mb-1 text-sm text-zinc-700">
            Sesion iniciada como <span className="font-semibold">{session.user.email}</span>
          </p>
          <p className="mb-2 text-xs text-zinc-500">Rol: {session.user.role}</p>

          {contextLoading && (
            <p className="mb-3 text-xs text-zinc-500">Cargando contexto de carrera...</p>
          )}

          {activeCareer && (
            <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Carrera activa
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-800">
                {activeCareer.nombre}
              </p>
              <Link
                href={quickPlanHref}
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800"
              >
                Abrir ultimo plan
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
            >
              Ir a perfil
            </Link>
            {(session.user.role === "MODERATOR" || session.user.role === "ADMIN") && (
              <Link
                href="/moderacion"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800"
              >
                Moderacion
              </Link>
            )}
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
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
              Cerrar sesion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
