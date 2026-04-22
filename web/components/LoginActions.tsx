"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

type Props = {
  callbackUrl: string;
  compact?: boolean;
  showGoogleLogin?: boolean;
};

export default function LoginActions({
  callbackUrl,
  compact = false,
  showGoogleLogin = false,
}: Props) {
  const [email, setEmail] = useState("tester@uns.local");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProduction = process.env.NODE_ENV === "production";
  const showDevLogin =
    process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true" ||
    (!isProduction && process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "false");
  const allowDevRoleOverride =
    process.env.NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE === "true" ||
    (!isProduction && process.env.NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE !== "false");

  const safeCallback = useMemo(() => {
    if (!callbackUrl.startsWith("/")) return "/perfil";
    return callbackUrl;
  }, [callbackUrl]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: safeCallback });
      // No llega aquí en el flujo normal: Google redirige de vuelta a NextAuth
    } catch {
      setError("No se pudo conectar con Google. Verificá tu conexión e intentá de nuevo.");
      setLoading(false);
    }
  }

  async function handleDevLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("dev-login", {
      email,
      role: allowDevRoleOverride ? role : "USER",
      callbackUrl: safeCallback,
      redirect: false,
    });

    if (result?.error) {
      setError("No se pudo iniciar sesión. Verificá el email e intentá de nuevo.");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <div
      className={
        compact
          ? "grid gap-3"
          : "grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      }
    >
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showGoogleLogin && (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-2.5 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!loading && <GoogleIcon />}
          {loading ? "Iniciando sesión..." : "Continuar con Google"}
        </button>
      )}

      {showGoogleLogin && showDevLogin && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs text-zinc-400">o</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>
      )}

      {showDevLogin && (
        <form
          className={
            compact
              ? "grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
              : "grid gap-3 rounded-xl border border-zinc-200 p-4"
          }
          onSubmit={handleDevLogin}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-800">Acceso de desarrollo</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              solo dev
            </span>
          </div>
          <input
            data-testid="dev-login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="usuario@uns.local"
            required
          />
          {allowDevRoleOverride ? (
            <select
              data-testid="dev-login-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="USER">USER</option>
              <option value="MODERATOR">MODERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          ) : (
            <p className="text-xs text-zinc-600">El rol se fija en USER en este entorno.</p>
          )}
          <button
            data-testid="dev-login-submit"
            type="submit"
            disabled={loading}
            className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Iniciando sesión..." : "Entrar con cuenta de desarrollo"}
          </button>
        </form>
      )}

      {!showDevLogin && !showGoogleLogin && (
        <p className="text-sm text-zinc-600">
          No hay proveedores de autenticacion habilitados en este entorno.
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
