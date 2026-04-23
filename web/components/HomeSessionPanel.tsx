"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import LoginActions from "@/components/LoginActions";
import {
  buildPlanHref,
  type UserSessionSummaryResponse,
} from "@/lib/userProductContextTypes";

const triggerCls =
  "inline-flex min-h-10 min-w-[178px] items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

export default function HomeSessionPanel() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [summary, setSummary] = useState<UserSessionSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showGoogleLogin = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

  async function loadUserContext() {
    setSummaryLoading(true);
    const response = await fetch("/api/perfil/resumen").catch(() => null);
    setSummaryLoading(false);
    if (!response?.ok) return null;
    return (await response.json()) as UserSessionSummaryResponse;
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    void (async () => {
      const payload = await loadUserContext();
      if (active && payload) setSummary(payload);
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!open || status !== "authenticated") return;
    let active = true;
    void (async () => {
      const payload = await loadUserContext();
      if (active && payload) setSummary(payload);
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  // ── Cargando sesión ────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className={`${triggerCls} border-zinc-200 text-zinc-400`}>
        Cargando...
      </div>
    );
  }

  // ── No autenticado ─────────────────────────────────────────────────────────
  if (status !== "authenticated" || !session.user) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={triggerCls}
        >
          Iniciar sesion
          <span aria-hidden="true" className="inline-block w-3 text-center text-zinc-400">
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Acceso"
            className="absolute right-0 z-30 mt-3 w-[min(92vw,400px)] rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
            style={{ animation: "dropdownIn 160ms ease-out" }}
          >
            <p className="mb-3 text-sm text-zinc-600">
              Ingresá para guardar y sincronizar tu progreso entre dispositivos.
            </p>
            <LoginActions
              callbackUrl="/perfil"
              compact
              showGoogleLogin={showGoogleLogin}
            />
            {/* Siempre hay un acceso directo a la página de login completa */}
            {showGoogleLogin && (
              <p className="mt-3 text-center text-xs text-zinc-400">
                o{" "}
                <Link
                  href="/login?next=/perfil"
                  className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                >
                  abrí la página de inicio de sesión
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Autenticado ────────────────────────────────────────────────────────────
  const activeCareerId = summary?.activeCareerId;
  const activeLastPlan = activeCareerId ? summary?.lastPlanByCareer[activeCareerId] : undefined;
  const quickPlanHref = activeCareerId ? buildPlanHref(activeCareerId, activeLastPlan) : "/";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={triggerCls}
      >
        <span className="max-w-[190px] truncate">{session.user.email}</span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-[11px] font-bold text-zinc-700">
          {session.user.role}
        </span>
        <span aria-hidden="true" className="inline-block w-3 text-center text-zinc-400">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu de sesion"
          className="absolute right-0 z-30 mt-3 w-[min(92vw,360px)] rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-xl"
          style={{ animation: "dropdownIn 160ms ease-out" }}
        >
          <p className="mb-1 truncate text-sm font-semibold text-zinc-800">
            {session.user.email}
          </p>
          <p className="mb-3 text-xs text-zinc-400">Rol: {session.user.role}</p>

          {/* Carrera activa — skeleton mientras carga */}
          {summaryLoading && !summary && (
            <div className="mb-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-4 w-40 animate-pulse rounded bg-zinc-200" />
            </div>
          )}

          {!summaryLoading && summary?.activeCareerName && (
            <div className="mb-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Carrera activa
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-800">
                {summary.activeCareerName}
              </p>
              <Link
                href={quickPlanHref}
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Abrir ultimo plan
              </Link>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Ir a perfil
            </Link>
            {(session.user.role === "MODERATOR" || session.user.role === "ADMIN") && (
              <Link
                href="/moderacion"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Moderacion
              </Link>
            )}
            {session.user.role === "ADMIN" && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut({ callbackUrl: "/" });
              }}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Cerrando sesion..." : "Cerrar sesion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
