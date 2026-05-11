// DEPRECATED: pendiente de borrar — reemplazado por CargarPlanTab.tsx
"use client";

import { useRef, useState } from "react";

type Status = { type: "idle" } | { type: "loading" } | { type: "success"; nombre: string } | { type: "error"; message: string };

export default function PlanUploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus({ type: "error", message: "Seleccioná un archivo primero." });
      return;
    }

    setStatus({ type: "loading" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/planes/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ type: "error", message: data.error ?? "Error desconocido." });
        return;
      }

      setStatus({ type: "success", nombre: data.nombre });
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setStatus({ type: "error", message: "Error de red al subir el archivo." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.json,.txt"
          className="text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-zinc-300 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
          onChange={() => setStatus({ type: "idle" })}
        />
        <button
          type="submit"
          disabled={status.type === "loading"}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {status.type === "loading" ? "Subiendo…" : "Subir plan"}
        </button>
      </div>

      {status.type === "success" && (
        <p className="text-sm text-green-700">
          Plan <strong>{status.nombre}</strong> validado correctamente.
        </p>
      )}
      {status.type === "error" && (
        <p className="text-sm text-red-600">{status.message}</p>
      )}
    </form>
  );
}
