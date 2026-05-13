"use client";

import { useEffect, useState } from "react";
import { GLASS, TEXT, TEXT_SEC, SURFACE, STATUS_COLORS, BTN, BTN_VIOLET, BTN_RED, INPUT } from "@/lib/ui/tokens";

type PlanPublicado = {
  id: string;
  nombre: string;
  departamento: string | null;
  disponible: boolean;
  jsonFile: string;
  tieneLocal: boolean;
  tieneGemini: boolean;
  materias: number | null;
  fuente: string | null;
  savedAt: string | null;
};

type EditorState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "open"; slug: string; nombre: string; originalJson: string; editedJson: string }
  | { type: "saving" };

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

function SeccionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

export default function PlanesTab() {
  const [planes, setPlanes] = useState<PlanPublicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ slug: string; ok: boolean; text: string } | null>(null);
  const [editor, setEditor] = useState<EditorState>({ type: "idle" });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editingDepto, setEditingDepto] = useState<string | null>(null);
  const [deptoValue, setDeptoValue] = useState("");
  const [savingDepto, setSavingDepto] = useState<string | null>(null);

  function cargar() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/planes/publicados")
      .then(r => r.json())
      .then(d => setPlanes(d.planes ?? []))
      .catch(() => setError("No se pudieron cargar los planes"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  async function toggleDisponible(p: PlanPublicado) {
    setToggling(p.id);
    setMsg(null);
    const res = await fetch(`/api/admin/planes/publicados/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disponible: !p.disponible }),
    });
    const data = await res.json();
    if (data.ok) {
      setPlanes(prev => prev.map(x => x.id === p.id ? { ...x, disponible: !p.disponible } : x));
      setMsg({ slug: p.id, ok: true, text: !p.disponible ? "Plan habilitado." : "Plan deshabilitado." });
    } else {
      setMsg({ slug: p.id, ok: false, text: data.error ?? "Error al cambiar estado." });
    }
    setToggling(null);
  }

  async function eliminar(p: PlanPublicado) {
    setDeleting(p.id);
    setMsg(null);
    const res = await fetch(`/api/admin/planes/publicados/${p.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      setPlanes(prev => prev.filter(x => x.id !== p.id));
    } else {
      setMsg({ slug: p.id, ok: false, text: data.error ?? "Error al eliminar." });
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  async function guardarDepto(slug: string) {
    setSavingDepto(slug);
    const res = await fetch("/api/admin/departamentos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, departamento: deptoValue }),
    });
    const data = await res.json();
    if (data.ok) {
      setPlanes(prev => prev.map(x => x.id === slug ? { ...x, departamento: data.departamento } : x));
      setMsg({ slug, ok: true, text: "Departamento actualizado." });
    } else {
      setMsg({ slug, ok: false, text: data.error ?? "Error al guardar departamento." });
    }
    setSavingDepto(null);
    setEditingDepto(null);
  }

  async function abrirEditor(p: PlanPublicado) {
    setEditor({ type: "loading" });
    setJsonError(null);
    const res = await fetch(`/api/admin/planes/publicados/${p.id}`);
    if (!res.ok) {
      setEditor({ type: "idle" });
      return;
    }
    const raw = await res.text();
    const pretty = JSON.stringify(JSON.parse(raw), null, 2);
    setEditor({ type: "open", slug: p.id, nombre: p.nombre, originalJson: pretty, editedJson: pretty });
  }

  async function guardarEdicion() {
    if (editor.type !== "open") return;
    setJsonError(null);
    const { slug, editedJson } = editor;
    try {
      JSON.parse(editedJson);
    } catch {
      setJsonError("JSON inválido — revisá la sintaxis antes de guardar.");
      return;
    }
    setEditor({ type: "saving" });
    const res = await fetch(`/api/admin/planes/publicados/${slug}`, {
      method: "PUT",
      body: editedJson,
    });
    const data = await res.json();
    if (data.ok) {
      setMsg({ slug, ok: true, text: "JSON guardado correctamente." });
      setEditor({ type: "idle" });
      cargar();
    } else {
      setMsg({ slug, ok: false, text: data.error ?? "Error al guardar." });
      setEditor({ type: "idle" });
    }
  }

  // ── Editor modal ───────────────────────────────────────────────────────────
  if (editor.type === "loading") {
    return (
      <div style={{ ...SURFACE, borderRadius: 12, padding: "60px 22px", textAlign: "center", color: TEXT_SEC, fontSize: 13 }}>
        Cargando JSON…
      </div>
    );
  }

  if (editor.type === "open" || editor.type === "saving") {
    const e = editor as Extract<typeof editor, { type: "open" }>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setEditor({ type: "idle" })}
            style={{ ...BTN, borderRadius: 8, padding: "4px 14px", fontSize: 12 }}
          >
            ← Volver
          </button>
          <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{e.nombre}</span>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>— editando JSON</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => setEditor({ ...e, editedJson: e.originalJson })}
              style={{ ...BTN, borderRadius: 8, padding: "4px 14px", fontSize: 12 }}
            >
              Restaurar original
            </button>
            <button
              onClick={guardarEdicion}
              disabled={editor.type === "saving"}
              style={{
                ...BTN_VIOLET, borderRadius: 8, padding: "4px 16px", fontSize: 12, fontWeight: 600,
                opacity: editor.type === "saving" ? 0.6 : 1,
                cursor: editor.type === "saving" ? "not-allowed" : "pointer",
              }}
            >
              {editor.type === "saving" ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
        {jsonError && (
          <div style={{ color: "#f87171", fontSize: 12, padding: "6px 10px", background: "rgba(248,113,113,0.1)", borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)" }}>
            {jsonError}
          </div>
        )}
        <textarea
          value={e.editedJson}
          onChange={ev => {
            setJsonError(null);
            setEditor({ ...e, editedJson: ev.target.value });
          }}
          spellCheck={false}
          style={{
            ...INPUT,
            borderRadius: 10,
            padding: "14px 16px",
            fontSize: 12,
            lineHeight: 1.65,
            fontFamily: "var(--font-mono, monospace)",
            minHeight: 600,
            resize: "vertical",
            width: "100%",
            boxSizing: "border-box",
            whiteSpace: "pre",
          }}
        />
      </div>
    );
  }

  // ── Lista de planes ────────────────────────────────────────────────────────
  return (
    <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
      <SeccionLabel>Planes publicados ({planes.length})</SeccionLabel>

      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_SEC, fontSize: 13 }}>Cargando…</div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: "32px 0", color: STATUS_COLORS.danger.accent, fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {planes.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "14px 6px",
                borderBottom: i < planes.length - 1 ? `1px solid ${GLASS.border}` : "none",
                opacity: p.disponible ? 1 : 0.55,
              }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{p.nombre}</span>
                  {!p.disponible && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: "rgba(168,155,201,0.12)", border: `1px solid rgba(168,155,201,0.3)`,
                      color: TEXT_SEC, borderRadius: 4, padding: "1px 7px",
                    }}>
                      Deshabilitado
                    </span>
                  )}
                </div>
                {editingDepto === p.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <input
                      autoFocus
                      value={deptoValue}
                      onChange={e => setDeptoValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") guardarDepto(p.id);
                        if (e.key === "Escape") setEditingDepto(null);
                      }}
                      placeholder="Departamento"
                      style={{
                        ...INPUT, borderRadius: 6, padding: "3px 8px",
                        fontSize: 11, width: 240,
                      }}
                    />
                    <button
                      onClick={() => guardarDepto(p.id)}
                      disabled={savingDepto === p.id}
                      style={{ ...BTN_VIOLET, borderRadius: 5, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      {savingDepto === p.id ? "…" : "Guardar"}
                    </button>
                    <button
                      onClick={() => setEditingDepto(null)}
                      style={{ ...BTN, borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      onClick={() => { setEditingDepto(p.id); setDeptoValue(p.departamento ?? ""); setMsg(null); }}
                      title="Editar departamento"
                      style={{ cursor: "pointer", borderBottom: "1px dashed", borderColor: "rgba(168,155,201,0.4)" }}
                    >
                      {p.departamento ?? "Sin departamento"}
                    </span>
                    {p.materias != null ? ` · ${p.materias} materias` : ""}
                    {p.fuente ? ` · ${p.fuente}` : ""}
                    {p.savedAt ? ` · ${tiempoRelativo(p.savedAt)}` : ""}
                    {" · "}<span style={{ opacity: 0.7 }}>{p.jsonFile}</span>
                  </div>
                )}
                {msg?.slug === p.id && (
                  <div style={{ fontSize: 11, marginTop: 4, fontWeight: 500, color: msg.ok ? "#90be6d" : "#f87171" }}>
                    {msg.text}
                  </div>
                )}
              </div>

              {/* Acciones */}
              {confirmDelete === p.id ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#f87171", fontWeight: 500 }}>¿Eliminar permanentemente?</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setConfirmDelete(null)} style={{ ...BTN, borderRadius: 6, padding: "4px 10px", fontSize: 11 }}>
                      Cancelar
                    </button>
                    <button
                      onClick={() => eliminar(p)}
                      disabled={deleting === p.id}
                      style={{
                        ...BTN_RED, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600,
                        opacity: deleting === p.id ? 0.6 : 1,
                        cursor: deleting === p.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {deleting === p.id ? "Eliminando…" : "Confirmar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => toggleDisponible(p)}
                    disabled={toggling === p.id}
                    style={{
                      ...BTN, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                      opacity: toggling === p.id ? 0.6 : 1,
                      cursor: toggling === p.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {toggling === p.id ? "…" : p.disponible ? "Deshabilitar" : "Habilitar"}
                  </button>
                  <button
                    onClick={() => abrirEditor(p)}
                    style={{ ...BTN, borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600 }}
                  >
                    Editar JSON
                  </button>
                  <button
                    onClick={() => { setConfirmDelete(p.id); setMsg(null); }}
                    style={{
                      background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)",
                      color: "#f87171", borderRadius: 6, padding: "5px 12px",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
