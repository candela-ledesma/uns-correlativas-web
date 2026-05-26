"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import LoginActions from "@/components/auth/LoginActions";

import { TEXT, TEXT_SEC, BTN as BTN_TOKEN, GLASS } from "@/lib/ui/tokens";
// SURFACE más prominente para el dropdown flotante (mayor blur que SURFACE base)
const SURFACE  = { background: GLASS.base, border: `1px solid ${GLASS.raised}`, backdropFilter: "blur(16px)" } as const;
// Botón pill con layout de inline-flex — combina el token visual con forma propia
const BTN_BASE = { ...BTN_TOKEN, borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" } as const;

// ── Trigger ────────────────────────────────────────────────────────────────
function Trigger({ onClick, expanded, children }: { onClick: () => void; expanded: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      style={{ ...BTN_BASE, minHeight: 40, minWidth: 0, maxWidth: "100%", width: "100%", justifyContent: "center" }}
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <span aria-hidden="true" style={{ fontSize: 10, color: TEXT_SEC, display: "inline-block", width: 12, textAlign: "center" }}>{open ? "▲" : "▼"}</span>;
}

export default function HomeSessionPanel() {
  const { data: session, status } = useSession();
  const [open,       setOpen]       = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const showGoogleLogin = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onOut);
    document.addEventListener("keydown",   onEsc);
    return () => { document.removeEventListener("mousedown", onOut); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return <div style={{ ...BTN_BASE, minHeight: 40, minWidth: 0, maxWidth: "100%", width: "100%", justifyContent: "center", cursor: "default", opacity: 0.5 }}>Cargando...</div>;
  }

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (status !== "authenticated" || !session.user) {
    return (
      <div ref={containerRef} style={{ position: "relative", minWidth: 0, width: "100%" }}>
        <Trigger onClick={() => setOpen((p) => !p)} expanded={open}>
          Iniciar sesión
          <Chevron open={open} />
        </Trigger>

        {open && (
          <div
            role="dialog"
            aria-label="Acceso"
            style={{ position: "absolute", right: 0, zIndex: 30, marginTop: 10, width: "min(92vw, 380px)", borderRadius: 20, padding: 20, animation: "dropdownIn 160ms ease-out", ...SURFACE }}
          >
            <p style={{ margin: "0 0 14px", color: TEXT_SEC, fontSize: 13, lineHeight: 1.6 }}>
              Ingresá para guardar y sincronizar tu progreso entre dispositivos.
            </p>
            <LoginActions callbackUrl="/perfil" compact showGoogleLogin={showGoogleLogin} />
            {showGoogleLogin && (
              <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12, color: TEXT_SEC }}>
                o{" "}
                <Link href="/login?next=/perfil" style={{ color: TEXT, textDecoration: "underline", textUnderlineOffset: 3 }}>
                  abrí la página de inicio de sesión
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 0, width: "100%" }}>
      <Trigger onClick={() => setOpen((p) => !p)} expanded={open}>
        <span style={{ flex: "1 1 0%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.email}</span>
        <span style={{ background: "rgba(157,78,221,0.25)", border: "1px solid rgba(157,78,221,0.4)", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#c084fc", flexShrink: 0 }}>
          {session.user.role}
        </span>
        <Chevron open={open} />
      </Trigger>

      {open && (
        <div
          role="menu"
          aria-label="Menú de sesión"
          style={{ position: "absolute", right: 0, zIndex: 30, marginTop: 10, width: "min(92vw, 340px)", borderRadius: 20, padding: 20, animation: "dropdownIn 160ms ease-out", ...SURFACE }}
        >
          <p style={{ margin: "0 0 2px", color: TEXT, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.user.email}
          </p>
          <p style={{ margin: "0 0 14px", color: TEXT_SEC, fontSize: 11 }}>Rol: {session.user.role}</p>

          {/* Nav links */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { href: "/perfil", label: "Ir a perfil", show: true },
            ].filter((l) => l.show).map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                style={{ ...BTN_BASE, borderRadius: 10, padding: "7px 14px", fontSize: 13, textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              disabled={signingOut}
              onClick={() => { setSigningOut(true); void signOut({ callbackUrl: "/" }); }}
              style={{ ...BTN_BASE, borderRadius: 10, padding: "7px 14px", fontSize: 13, opacity: signingOut ? 0.6 : 1, cursor: signingOut ? "not-allowed" : "pointer" }}
            >
              {signingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
