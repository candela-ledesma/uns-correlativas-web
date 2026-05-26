"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[planes/error]", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span aria-hidden="true">←</span>
            <span>Volver al inicio</span>
          </Link>
        </div>

        <section className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-xl text-red-700">
            !
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Error al cargar el plan
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Ocurrió un error inesperado al renderizar este plan de estudios.
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-800">Detalle técnico</h2>
              <pre className="overflow-auto text-xs text-red-700 whitespace-pre-wrap">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            </div>
          )}

          <button
            onClick={reset}
            className="mt-6 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Reintentar
          </button>
        </section>
      </div>
    </main>
  );
}
