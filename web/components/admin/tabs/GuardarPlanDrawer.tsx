"use client";

import { useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, BTN, INPUT, STATUS_COLORS, ERROR_PANEL } from "@/lib/ui/tokens";

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{ id: string; nombre: string; año: string | null; correlativas: Record<string, unknown>; horas: string; categoria: string }>;
  agrupadores: unknown[];
  _llm_prompt_version?: string;
};

type ConflictInfo = {
  materias: number;
  fechaCarga: string;
  fuente: string;
};

type SaveState =
  | { type: "confirming" }
  | { type: "conflict"; existing: ConflictInfo }
  | { type: "saving" }
  | { type: "success"; slug: string }
  | { type: "error"; message: string };

type ResolucionConflicto = "reemplazar" | "conservar" | "nueva_version";

const RESOLUCION_OPTIONS: { value: ResolucionConflicto; label: string; desc: string; recommended?: boolean }[] = [
  { value: "reemplazar",     label: "Reemplazar completamente", desc: "La versión nueva reemplaza todo el plan actual." },
  { value: "conservar",      label: "Conservar la actual",       desc: "Descartá la nueva versión. No se guarda nada." },
  { value: "nueva_version",  label: "Guardar como nueva versión", desc: "Mantiene ambas versiones. La nueva queda como v2.", recommended: true },
];

export default function GuardarPlanDrawer({
  data,
  fuente,
  onClose,
}: {
  data: ParseResult;
  fuente: "gemini" | "parser";
  onClose: () => void;
}) {
  const [saveState, setSaveState] = useState<SaveState>({ type: "confirming" });
  const [publicar, setPublicar] = useState(true);
  const [resolucion, setResolucion] = useState<ResolucionConflicto | null>(null);
  const [motivo, setMotivo] = useState("");

  async function iniciarGuardado() {
    setSaveState({ type: "saving" });
    try {
      const res = await fetch("/api/admin/planes/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data, fuente, publicar, resolucion: null }),
      });
      const json = await res.json();
      if (json.conflict) {
        setSaveState({ type: "conflict", existing: json.existing });
      } else if (!res.ok) {
        setSaveState({ type: "error", message: json.error || "Error desconocido" });
      } else {
        setSaveState({ type: "success", slug: json.slug });
      }
    } catch (e) {
      setSaveState({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function confirmarConflicto() {
    if (!resolucion || resolucion === "conservar") { onClose(); return; }
    if (!motivo.trim()) return;
    setSaveState({ type: "saving" });
    try {
      const res = await fetch("/api/admin/planes/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: data, fuente, publicar, resolucion, motivo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveState({ type: "error", message: json.error || "Error desconocido" });
      } else {
        setSaveState({ type: "success", slug: json.slug });
      }
    } catch (e) {
      setSaveState({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const fuenteLabel = fuente === "gemini" ? "Gemini" : "Parser clásico";
  const isSaving = saveState.type === "saving";

  return (
    <div style={{
      marginTop: 16,
      background: GLASS.dim, border: `1px solid ${GLASS.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: GLASS.elevated,
        borderBottom: `1px solid ${GLASS.border}`,
      }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>
          {saveState.type === "conflict" ? "⚠ Este plan ya existe" : saveState.type === "success" ? "✓ Plan guardado" : "Guardar plan"}
        </div>
        {saveState.type !== "saving" && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}>×</button>
        )}
      </div>

      <div style={{ padding: 16 }}>

        {/* SUCCESS */}
        {saveState.type === "success" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT, marginBottom: 6 }}>Plan guardado correctamente</div>
            <a
              href={`/planes/${saveState.slug}`}
              style={{ fontSize: 12, color: ACCENT, textDecoration: "none" }}
            >
              Ver plan en la web →
            </a>
          </div>
        )}

        {/* ERROR */}
        {saveState.type === "error" && (
          <div>
            <div style={{ ...ERROR_PANEL, borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 12 }}>
              ⚠ {saveState.message}
            </div>
            <button
              onClick={() => setSaveState({ type: "confirming" })}
              style={{ ...BTN, borderRadius: 8, padding: "7px 14px", fontSize: 12 }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* SAVING */}
        {saveState.type === "saving" && (
          <div style={{ textAlign: "center", padding: "24px 0", color: TEXT_SEC, fontSize: 13 }}>
            <div style={{ marginBottom: 8, fontSize: 20 }}>⏳</div>
            Guardando…
          </div>
        )}

        {/* CONFIRMING */}
        {saveState.type === "confirming" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Resumen</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Universidad", value: data.plan.universidad },
                { label: "Carrera", value: data.plan.carrera },
                { label: "Plan", value: data.plan.codigo_plan },
                { label: "Materias", value: String(data.materias.length) },
                { label: "Fuente", value: fuenteLabel },
                { label: "Fecha", value: new Date().toLocaleDateString("es-AR") },
              ].map(item => (
                <div key={item.label} style={{ background: GLASS.soft, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: TEXT_SEC, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: TEXT, fontWeight: 500 }}>{item.value}</div>
                </div>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: TEXT_SEC }}>
              <input
                type="checkbox"
                checked={publicar}
                onChange={e => setPublicar(e.target.checked)}
                style={{ accentColor: ACCENT, width: 14, height: 14 }}
              />
              <span><strong style={{ color: TEXT }}>Publicar inmediatamente</strong></span>
            </label>
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                onClick={iniciarGuardado}
                disabled={isSaving}
                style={{
                  background: STATUS_COLORS.aprobada.badgeBg,
                  border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
                  color: STATUS_COLORS.aprobada.accent,
                  borderRadius: 8, padding: "8px 18px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Confirmar y guardar
              </button>
              <button onClick={onClose} style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        )}

        {/* CONFLICT */}
        {saveState.type === "conflict" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12, color: STATUS_COLORS.disponible.accent }}>
              {data.plan.codigo_plan} — {data.plan.carrera} — {data.plan.universidad} · Última modificación: {saveState.existing.fechaCarga}
            </div>

            {/* Comparación */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: GLASS.soft, border: `1px solid ${GLASS.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC, marginBottom: 8 }}>Versión actual (producción)</div>
                <Row label="Materias" value={String(saveState.existing.materias)} />
                <Row label="Fuente" value={saveState.existing.fuente} />
                <Row label="Carga" value={saveState.existing.fechaCarga} />
              </div>
              <div style={{ background: GLASS.soft, border: `1px solid ${GLASS.raised}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: ACCENT, marginBottom: 8 }}>Versión nueva</div>
                <Row label="Materias" value={String(data.materias.length)} diff={data.materias.length !== saveState.existing.materias} />
                <Row label="Fuente" value={fuenteLabel} />
                <Row label="Fecha" value={new Date().toLocaleDateString("es-AR")} />
              </div>
            </div>

            {/* Opciones */}
            <div style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Elegí una opción</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {RESOLUCION_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                    padding: "10px 12px", borderRadius: 9,
                    border: `1px solid ${resolucion === opt.value ? ACCENT : GLASS.border}`,
                    background: resolucion === opt.value ? "rgba(157,78,221,0.1)" : GLASS.faint,
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="resolucion"
                    value={opt.value}
                    checked={resolucion === opt.value}
                    onChange={() => setResolucion(opt.value)}
                    style={{ accentColor: ACCENT, marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{opt.label}</span>
                      {opt.recommended && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 20,
                          background: "rgba(157,78,221,0.2)", border: `1px solid ${ACCENT}`, color: ACCENT,
                        }}>Recomendado</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Motivo (solo si no es conservar) */}
            {resolucion && resolucion !== "conservar" && (
              <div>
                <div style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 500, marginBottom: 5 }}>
                  Motivo del cambio <span style={{ color: STATUS_COLORS.danger.accent }}>*</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Describí brevemente por qué se actualiza este plan…"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  style={{ ...INPUT, borderRadius: 8, padding: "8px 12px", fontSize: 12, resize: "vertical" }}
                />
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                onClick={confirmarConflicto}
                disabled={!resolucion || (resolucion !== "conservar" && !motivo.trim()) || isSaving}
                style={{
                  background: STATUS_COLORS.aprobada.badgeBg,
                  border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
                  color: STATUS_COLORS.aprobada.accent,
                  borderRadius: 8, padding: "8px 18px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: !resolucion || (resolucion !== "conservar" && !motivo.trim()) ? 0.4 : 1,
                }}
              >
                {isSaving ? "Guardando…" :
                  resolucion === "reemplazar" ? "Reemplazar plan" :
                  resolucion === "conservar"  ? "Cancelar" :
                  resolucion === "nueva_version" ? "Guardar como v2" :
                  "Confirmar"}
              </button>
              <button onClick={onClose} style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>Cancelar</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, diff }: { label: string; value: string; diff?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
      <span style={{ color: TEXT_SEC }}>{label}</span>
      <span style={{ color: diff ? STATUS_COLORS.disponible.accent : TEXT, fontWeight: diff ? 600 : 400 }}>
        {value}
      </span>
    </div>
  );
}
