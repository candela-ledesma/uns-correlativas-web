"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

import { TEXT, TEXT_SEC, SURFACE, INPUT as INPUT_BASE, BTN as BTN_BASE, BTN_VIOLET, ERROR_PANEL } from "@/lib/ui/tokens";
const INPUT   = { ...INPUT_BASE, borderRadius: 10, padding: "10px 14px", fontSize: 14 } as const;
const BTN     = { ...BTN_BASE,   borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, width: "100%", textAlign: "center" } as const;
const BTN_VIO = { ...BTN_VIOLET, borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 700, width: "100%", textAlign: "center" } as const;

type Props = {
  callbackUrl: string;
  compact?: boolean;
  showGoogleLogin?: boolean;
};

export default function LoginActions({ callbackUrl, compact = false, showGoogleLogin = false }: Props) {
  const [email,   setEmail]   = useState("tester@uns.local");
  const [role,    setRole]    = useState("USER");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const isProduction = process.env.NODE_ENV === "production";
  const showDevLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true" ||
    (!isProduction && process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "false");
  const allowDevRoleOverride = process.env.NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE === "true" ||
    (!isProduction && process.env.NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE !== "false");

  const noProviders = !showGoogleLogin && !showDevLogin;

  const safeCallback = useMemo(() => callbackUrl.startsWith("/") ? callbackUrl : "/perfil", [callbackUrl]);

  async function handleGoogleLogin() {
    setLoading(true); setError(null);
    try {
      await signIn("google", { callbackUrl: safeCallback });
    } catch {
      setError("No se pudo conectar con Google. Verificá tu conexión e intentá de nuevo.");
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    setLoading(true); setError(null);
    const result = await signIn("dev-login", {
      email, role: allowDevRoleOverride ? role : "USER",
      callbackUrl: safeCallback, redirect: false,
    });
    if (result?.error) {
      setError("No se pudo iniciar sesión. Verificá el email e intentá de nuevo.");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  // Compact sin providers → link directo a /login
  if (noProviders && compact) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(safeCallback)}`}
        style={{ ...BTN, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
      >
        Iniciar sesión →
      </Link>
    );
  }

  const wrapStyle = compact
    ? { display: "grid", gap: 12 }
    : { display: "grid", gap: 16, ...SURFACE, borderRadius: 20, padding: 24 };

  return (
    <div style={wrapStyle}>

      {error && (
        <div role="alert" aria-live="polite"
          style={{ ...ERROR_PANEL, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {showGoogleLogin && (
        <button type="button" onClick={() => void handleGoogleLogin()} disabled={loading}
          style={{ ...BTN, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: loading ? 0.6 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
          {!loading && <GoogleIcon />}
          {loading ? "Iniciando sesión..." : "Continuar con Google"}
        </button>
      )}

      {showGoogleLogin && showDevLogin && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
          <span style={{ color: TEXT_SEC, fontSize: 12 }}>o</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.10)" }} />
        </div>
      )}

      {showDevLogin && (
        <form onSubmit={(e) => { e.preventDefault(); void handleDevLogin(); }}
          style={{ display: "grid", gap: 12, ...SURFACE, borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>Acceso de desarrollo</span>
            <span style={{ background: "rgba(249,199,79,0.15)", border: "1px solid rgba(249,199,79,0.3)", borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f9c74f" }}>
              solo dev
            </span>
          </div>
          <input
            data-testid="dev-login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={INPUT}
            placeholder="usuario@uns.local"
            required
          />
          {allowDevRoleOverride ? (
            <select data-testid="dev-login-role" value={role} onChange={(e) => setRole(e.target.value)} style={INPUT}>
              <option value="USER">USER</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC, fontSize: 12 }}>El rol se fija en USER en este entorno.</p>
          )}
          <button data-testid="dev-login-submit" type="submit" disabled={loading}
            style={{ ...BTN_VIO, opacity: loading ? 0.65 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Iniciando sesión..." : "Entrar con cuenta de desarrollo"}
          </button>
        </form>
      )}

      {noProviders && !compact && (
        <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13 }}>
          No hay proveedores configurados en este entorno.{" "}
          <Link href="/login" style={{ color: TEXT, textDecoration: "underline", textUnderlineOffset: 3 }}>
            Ir a inicio de sesión
          </Link>
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 13.652 17.64 11.525 17.64 9.2Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"/>
    </svg>
  );
}
