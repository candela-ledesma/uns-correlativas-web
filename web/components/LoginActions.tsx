"use client";

import { FormEvent, useMemo, useState } from "react";
import { signIn } from "next-auth/react";

type Props = {
  callbackUrl: string;
  compact?: boolean;
};

export default function LoginActions({ callbackUrl, compact = false }: Props) {
  const [email, setEmail] = useState("tester@uns.local");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(false);
  const showDevLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "false";

  const safeCallback = useMemo(() => {
    if (!callbackUrl.startsWith("/")) return "/perfil";
    return callbackUrl;
  }, [callbackUrl]);

  async function handleDevLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    await signIn("dev-login", {
      email,
      role,
      callbackUrl: safeCallback,
    });
  }

  return (
    <div
      className={
        compact
          ? "grid gap-3"
          : "grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      }
    >
      {showDevLogin && (
        <form
          className={
            compact
              ? "grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
              : "grid gap-3 rounded-xl border border-zinc-200 p-4"
          }
          onSubmit={handleDevLogin}
        >
          <h2 className="text-sm font-semibold text-zinc-800">Acceso de desarrollo (tests)</h2>
          <input
            data-testid="dev-login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="usuario@uns.local"
            required
          />
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
          <button
            data-testid="dev-login-submit"
            type="submit"
            disabled={loading}
            className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            Entrar con cuenta de desarrollo
          </button>
        </form>
      )}

      {!showDevLogin && (
        <p className="text-sm text-zinc-600">
          El acceso por credenciales esta deshabilitado en este entorno.
        </p>
      )}
    </div>
  );
}
