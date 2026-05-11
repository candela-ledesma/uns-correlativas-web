"use client";

import { useCallback, useRef, useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT, STATUS_COLORS, ERROR_PANEL } from "@/lib/ui/tokens";
import DiffExportDrawer from "./DiffExportDrawer";
import GuardarPlanDrawer from "./GuardarPlanDrawer";
import type { ParseResult } from "./DiffExportDrawer";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";

type ProgressStep = "leyendo" | "enviando" | "generando" | "guardando" | "parseando";

const STEP_LABELS_GEMINI: ProgressStep[] = ["leyendo", "enviando", "generando"];
const STEP_LABELS_LOCAL: ProgressStep[] = ["guardando", "parseando", "leyendo"];

const STEP_LABEL: Record<ProgressStep, string> = {
  leyendo:   "Leyendo el PDF…",
  enviando:  "Enviando a Gemini…",
  generando: "Generando JSON…",
  guardando: "Preparando el PDF…",
  parseando: "Ejecutando parser local…",
};

type Status =
  | { type: "idle" }
  | { type: "loading"; step: ProgressStep; message: string }
  | { type: "error"; message: string }
  | { type: "done"; data: ParseResult };

const CARD: React.CSSProperties = {
  ...SURFACE,
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12,
};

export default function CargarPlanTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [dryRun, setDryRun] = useState(false);
  const [uniType, setUniType] = useState<"uns" | "otra">("uns");
  const [uniNombre, setUniNombre] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [resultadoLocal, setResultadoLocal] = useState<ParseResult | null>(null);
  const [resultadoGemini, setResultadoGemini] = useState<ParseResult | null>(null);
  const [highlightDiffs, setHighlightDiffs] = useState(true);
  const [validationOpen, setValidationOpen] = useState(true);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setStatus({ type: "idle" });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function parsearSSE(endpoint: string, fd: FormData, initialStep: ProgressStep, onDone: (data: ParseResult) => void) {
    setStatus({ type: "loading", step: initialStep, message: STEP_LABEL[initialStep] });
    try {
      const res = await fetch(endpoint, { method: "POST", body: fd });
      if (!res.body) throw new Error("No se recibió respuesta del servidor");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const dataLine = line.startsWith("data: ") ? line.slice(6) : null;
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine);
            if (event.type === "progress") {
              setStatus({ type: "loading", step: event.step as ProgressStep, message: event.message });
            } else if (event.type === "done") {
              const data = event.data as ParseResult;
              onDone(data);
              setStatus({ type: "done", data });
            } else if (event.type === "error") {
              setStatus({ type: "error", message: event.message });
            }
          } catch {}
        }
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function parsear() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("model", model);
    parsearSSE("/api/admin/planes/parsear", fd, "leyendo", (data) => setResultadoGemini(data));
  }

  function parsearLocal() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    parsearSSE("/api/admin/planes/parsear-local", fd, "guardando", (data) => setResultadoLocal(data));
  }

  function limpiar() {
    setFile(null);
    setStatus({ type: "idle" });
    setResultadoLocal(null);
    setResultadoGemini(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function copyJSON(data: ParseResult) {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  const kb = file ? (file.size / 1024).toFixed(1) : null;

  function byYear(materias: ParseResult["materias"]) {
    const map: Record<string, typeof materias> = {};
    for (const m of materias) {
      const k = m.año ?? "Sin año";
      (map[k] ??= []).push(m);
    }
    return map;
  }

  return (
    <div>
      {/* Universidad */}
      <div style={CARD}>
        <div style={LABEL}>Universidad</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["uns", "otra"] as const).map(u => (
            <button
              key={u}
              onClick={() => setUniType(u)}
              style={{
                border: `1px solid ${uniType === u ? ACCENT : GLASS.border}`,
                borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                background: uniType === u ? "rgba(157,78,221,0.12)" : GLASS.elevated,
                textAlign: "left", transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>
                {u === "uns" ? "🏛 UNS" : "🌐 Otra universidad"}
              </div>
              <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>
                {u === "uns" ? "Universidad Nacional del Sur" : "Ingresar nombre manualmente"}
              </div>
            </button>
          ))}
        </div>
        {uniType === "otra" && (
          <input
            style={{ ...INPUT, marginTop: 10, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}
            placeholder="Nombre de la universidad..."
            value={uniNombre}
            onChange={e => setUniNombre(e.target.value)}
          />
        )}
      </div>

      {/* Dropzone */}
      <div style={CARD}>
        <div style={LABEL}>Archivo PDF</div>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? ACCENT : GLASS.raised}`,
            borderRadius: 10, padding: "28px 20px",
            textAlign: "center", cursor: "pointer",
            background: dragging ? "rgba(157,78,221,0.08)" : "transparent",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📄</div>
          <div style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 12 }}>
            <span style={{ color: TEXT, fontWeight: 600 }}>Arrastrá el PDF aquí</span>
            {" "}o hacé click para buscar
          </div>
          <input
            ref={fileInputRef}
            type="file" accept=".pdf"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
            style={{ ...BTN, borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 500 }}
          >
            Buscar archivo
          </button>
        </div>

        {file && (
          <div style={{
            marginTop: 12, display: "flex", alignItems: "center", gap: 10,
            background: GLASS.elevated, border: `1px solid ${GLASS.border}`,
            borderRadius: 8, padding: "10px 12px",
          }}>
            <span style={{ fontSize: 18, opacity: 0.7 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </div>
              <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 1 }}>{kb} KB</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: STATUS_COLORS.disponible.accent }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLORS.disponible.accent, display: "inline-block" }} />
              Listo para parsear
            </div>
            <button
              onClick={limpiar}
              style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}
            >×</button>
          </div>
        )}
      </div>

      {/* Opciones */}
      <div style={CARD}>
        <div style={LABEL}>Opciones de parseo</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 500, marginBottom: 5 }}>Modelo</div>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ ...INPUT, borderRadius: 8, padding: "8px 10px", fontSize: 13, appearance: "none" }}
            >
              {GEMINI_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: TEXT_SEC }}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
                style={{ accentColor: ACCENT, width: 14, height: 14, cursor: "pointer" }}
              />
              <span><strong style={{ color: TEXT }}>Dry run</strong> — no guardar</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingTop: 16, marginTop: 4, borderTop: `1px solid ${GLASS.border}`,
        }}>
          <button
            onClick={parsear}
            disabled={!file || status.type === "loading"}
            style={{
              ...BTN_VIOLET, borderRadius: 8, padding: "8px 18px",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: !file || status.type === "loading" ? 0.5 : 1,
              cursor: !file || status.type === "loading" ? "not-allowed" : "pointer",
            }}
          >
            <span>🤖</span>
            {status.type === "loading" && STEP_LABELS_GEMINI.includes(status.step) ? status.message : "Parsear con Gemini"}
          </button>
          <button
            onClick={parsearLocal}
            disabled={!file || status.type === "loading"}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: !file || status.type === "loading" ? 0.5 : 1,
              cursor: !file || status.type === "loading" ? "not-allowed" : "pointer",
            }}
          >
            <span>⚙️</span>
            {status.type === "loading" && STEP_LABELS_LOCAL.includes(status.step) ? status.message : "Parsear local"}
          </button>
          <button
            onClick={limpiar}
            style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500 }}
          >
            Limpiar
          </button>
          <div style={{ marginLeft: "auto", fontSize: 11, color: TEXT_SEC, textAlign: "right" }}>
            El plan se convierte<br />a JSON de correlativas
          </div>
        </div>

        {status.type === "loading" && (() => {
          const isLocal = STEP_LABELS_LOCAL.includes(status.step);
          const steps = isLocal ? STEP_LABELS_LOCAL : STEP_LABELS_GEMINI;
          const currentIdx = steps.indexOf(status.step);
          return (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {steps.map((step, i) => {
                const isDone = i < currentIdx;
                const isActive = i === currentIdx;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                      background: isDone ? "rgba(34,197,94,0.15)" : isActive ? "rgba(157,78,221,0.2)" : GLASS.elevated,
                      border: `1px solid ${isDone ? "#22c55e" : isActive ? ACCENT : GLASS.border}`,
                      color: isDone ? "#22c55e" : isActive ? ACCENT : TEXT_SEC,
                      flexShrink: 0,
                    }}>
                      {isDone ? "✓" : i + 1}
                    </span>
                    <span style={{ color: isActive ? TEXT : TEXT_SEC, fontWeight: isActive ? 600 : 400 }}>
                      {STEP_LABEL[step]}
                    </span>
                    {isActive && (
                      <span style={{ marginLeft: 2, color: ACCENT, fontSize: 11 }}>●</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Error */}
      {status.type === "error" && (
        <div style={{ ...ERROR_PANEL, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
          ⚠ {status.message}
        </div>
      )}

      {/* Resultado */}
      {status.type === "done" && (
        <ResultadoParseo
          data={status.data}
          ground={
            status.data === resultadoGemini ? resultadoLocal :
            status.data === resultadoLocal  ? resultadoGemini :
            null
          }
          highlightDiffs={highlightDiffs}
          onToggleHighlight={setHighlightDiffs}
          validationOpen={validationOpen}
          onToggleValidation={() => setValidationOpen(v => !v)}
          onCopy={() => copyJSON(status.data)}
          byYear={byYear}
        />
      )}
    </div>
  );
}

function ResultadoParseo({
  data, ground, highlightDiffs, onToggleHighlight,
  validationOpen, onToggleValidation, onCopy, byYear,
}: {
  data: ParseResult;
  ground: ParseResult | null;
  highlightDiffs: boolean;
  onToggleHighlight: (v: boolean) => void;
  validationOpen: boolean;
  onToggleValidation: () => void;
  onCopy: () => void;
  byYear: (m: ParseResult["materias"]) => Record<string, ParseResult["materias"]>;
}) {
  const conf = data._llm_confidence != null ? Math.round(data._llm_confidence * 100) : null;
  const grouped = byYear(data.materias);
  const [showFewShot, setShowFewShot] = useState(false);
  const [guardarFuente, setGuardarFuente] = useState<"gemini" | "parser" | null>(null);

  return (
    <div>
      {/* Toggle bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 14, padding: "10px 14px",
        ...SURFACE, borderRadius: 8,
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: TEXT_SEC }}>
          <input
            type="checkbox" checked={highlightDiffs}
            onChange={e => onToggleHighlight(e.target.checked)}
            style={{ accentColor: ACCENT, width: 14, height: 14 }}
          />
          Resaltar diferencias
        </label>
        <span style={{ fontSize: 12, color: TEXT_SEC }}>PDF original ↔ JSON generado</span>
        {conf != null && (
          <span style={{
            marginLeft: "auto",
            background: STATUS_COLORS.aprobada.badgeBg,
            border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
            color: STATUS_COLORS.aprobada.accent,
            borderRadius: 20, padding: "3px 12px",
            fontSize: 12, fontWeight: 600,
          }}>
            Confianza: {conf}%
          </span>
        )}
      </div>

      {/* Two-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* PDF panel */}
        <div style={{ ...SURFACE, borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: `1px solid ${GLASS.border}`,
            background: GLASS.elevated,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
              📄 Plan extraído
            </span>
          </div>
          <div style={{ padding: 14, overflow: "auto", maxHeight: 440, fontSize: 11 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: TEXT, marginBottom: 2 }}>{data.plan.universidad}</div>
            <div style={{ fontWeight: 600, color: TEXT_SEC, marginBottom: 12, fontSize: 12 }}>
              {data.plan.carrera} — {data.plan.codigo_plan}
            </div>
            {Object.entries(grouped).map(([year, mats]) => (
              <div key={year}>
                <div style={{ fontWeight: 700, fontSize: 11, color: "#c084fc", textTransform: "uppercase", margin: "10px 0 4px" }}>
                  {year}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
                  <thead>
                    <tr>
                      {["Cód.", "Materia", "Hs.", "Correlativas"].map(h => (
                        <th key={h} style={{ fontSize: 10, color: TEXT_SEC, textAlign: "left", padding: "3px 6px", borderBottom: `1px solid ${GLASS.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map(m => {
                      const cors = Object.keys(m.correlativas).join(", ") || "—";
                      return (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${GLASS.faint}` }}>
                          <td style={{ padding: "4px 6px", color: TEXT_SEC }}>{m.id}</td>
                          <td style={{ padding: "4px 6px", color: TEXT }}>{m.nombre}</td>
                          <td style={{ padding: "4px 6px", color: TEXT_SEC }}>{m.horas || "—"}</td>
                          <td style={{ padding: "4px 6px", color: TEXT_SEC, fontSize: 10 }}>{cors}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* JSON panel */}
        <div style={{ ...SURFACE, borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: `1px solid ${GLASS.border}`,
            background: GLASS.elevated,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
              {"{ }"} JSON generado
            </span>
            <button
              onClick={onCopy}
              style={{ ...BTN, borderRadius: 6, padding: "4px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
            >
              📋 Copiar
            </button>
          </div>
          <div style={{ padding: 14, overflow: "auto", maxHeight: 440 }}>
            <pre style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 11, lineHeight: 1.7,
              color: TEXT_SEC, whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Validation bar */}
      <div style={{ ...SURFACE, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
        <div
          onClick={onToggleValidation}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
            ✅ Validación automática
          </span>
          <span style={{ color: TEXT_SEC, fontSize: 11, transform: validationOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </div>
        {validationOpen && (
          <div style={{ borderTop: `1px solid ${GLASS.border}`, padding: "4px 14px 12px" }}>
            {(() => {
              const ids = data.materias.map(m => m.id);
              const uniqueIds = new Set(ids);
              const duplicados = ids.length - uniqueIds.size;
              const sinAño = data.materias.filter(m => !m.año).length;
              const todasLasIds = new Set([...ids, ...data.agrupadores.map((a: unknown) => (a as { id?: string }).id).filter(Boolean)]);
              const correlativasRotas = data.materias.reduce((acc, m) => {
                const rotas = Object.keys(m.correlativas).filter(cid => !todasLasIds.has(cid));
                return acc + rotas.length;
              }, 0);
              const tieneCarrera = !!data.plan.carrera && !!data.plan.universidad && !!data.plan.codigo_plan;

              const checks = [
                { ok: tieneCarrera,          label: "Campos del plan",       note: tieneCarrera ? `${data.plan.carrera}` : "Falta carrera, universidad o código" },
                { ok: duplicados === 0,      label: "IDs únicos",            note: duplicados === 0 ? `${ids.length} materias` : `${duplicados} duplicado${duplicados > 1 ? "s" : ""}` },
                { ok: sinAño === 0,          label: "Año asignado",          note: sinAño === 0 ? "Todas tienen año" : `${sinAño} sin año` },
                { ok: correlativasRotas === 0, label: "Correlativas válidas", note: correlativasRotas === 0 ? "Todas las IDs existen" : `${correlativasRotas} ID${correlativasRotas > 1 ? "s" : ""} no encontrada${correlativasRotas > 1 ? "s" : ""}` },
                { ok: data.agrupadores.length > 0, label: "Agrupadores",    note: `${data.agrupadores.length} grupo${data.agrupadores.length !== 1 ? "s" : ""}` },
              ];

              return checks.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 0", fontSize: 12, color: TEXT,
                  borderBottom: i < checks.length - 1 ? `1px solid ${GLASS.faint}` : "none",
                }}>
                  <span style={{ width: 18, textAlign: "center" }}>{c.ok ? "✅" : "⚠️"}</span>
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span style={{ fontSize: 11, color: c.ok ? TEXT_SEC : "#fca5a5" }}>{c.note}</span>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Final actions */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "14px 16px", ...SURFACE, borderRadius: 12,
      }}>
        <button
          onClick={() => setShowFewShot(v => !v)}
          style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}
        >
          🧪 {showFewShot ? "Cerrar few-shot" : "Exportar diff como few-shot"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setGuardarFuente("parser")}
          style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}
        >
          💾 Usar parser
        </button>
        <button
          onClick={() => setGuardarFuente("gemini")}
          style={{
            background: STATUS_COLORS.aprobada.badgeBg,
            border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
            color: STATUS_COLORS.aprobada.accent,
            borderRadius: 8, padding: "8px 16px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          ✓ Usar Gemini
        </button>
      </div>

      {showFewShot && (
        <DiffExportDrawer
          gemini={data}
          ground={ground}
          onClose={() => setShowFewShot(false)}
        />
      )}

      {guardarFuente && (
        <GuardarPlanDrawer
          data={data}
          fuente={guardarFuente}
          onClose={() => setGuardarFuente(null)}
        />
      )}
    </div>
  );
}
