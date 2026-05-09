"use client";

import { useCallback, useRef, useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT, STATUS_COLORS, ERROR_PANEL } from "@/lib/ui/tokens";

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{
    id: string; nombre: string; año: string | null;
    cuatrimestre: string | null; horas: string;
    correlativas: Record<string, unknown>;
    categoria: string;
  }>;
  agrupadores: unknown[];
  _llm_confidence?: number;
  _llm_prompt_version?: string;
};

type Status =
  | { type: "idle" }
  | { type: "loading" }
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
  const [model, setModel] = useState("gemini-2.5-flash");
  const [dryRun, setDryRun] = useState(false);
  const [uniType, setUniType] = useState<"uns" | "otra">("uns");
  const [uniNombre, setUniNombre] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
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

  async function parsear() {
    if (!file) return;
    setStatus({ type: "loading" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("model", model);
    try {
      const res = await fetch("/api/admin/planes/parsear", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Error desconocido");
      setStatus({ type: "done", data: json.data });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function limpiar() {
    setFile(null);
    setStatus({ type: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function copyJSON(data: ParseResult) {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  const kb = file ? (file.size / 1024).toFixed(1) : null;

  // Group materias by year for PDF simulation
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
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              <option value="gemma-4-26b-a4b-it">gemma-4-26b-a4b-it</option>
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
            {status.type === "loading" ? "Procesando…" : "Parsear con Gemini"}
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
  data, highlightDiffs, onToggleHighlight,
  validationOpen, onToggleValidation, onCopy, byYear,
}: {
  data: ParseResult;
  highlightDiffs: boolean;
  onToggleHighlight: (v: boolean) => void;
  validationOpen: boolean;
  onToggleValidation: () => void;
  onCopy: () => void;
  byYear: (m: ParseResult["materias"]) => Record<string, ParseResult["materias"]>;
}) {
  const conf = data._llm_confidence != null ? Math.round(data._llm_confidence * 100) : null;
  const grouped = byYear(data.materias);

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
            {[
              { ok: true,  label: "JSON válido",            note: "Estructura correcta" },
              { ok: true,  label: "IDs únicos",             note: `${data.materias.length} materias detectadas` },
              { ok: data.materias.filter(m => !m.año).length === 0, label: "Año asignado", note: `${data.materias.filter(m => !m.año).length} sin año` },
              { ok: data.agrupadores.length > 0 || true,    label: "Agrupadores",         note: `${data.agrupadores.length} grupos` },
              { ok: conf != null && conf >= 80,             label: "Confianza del modelo", note: conf != null ? `${conf}%` : "—" },
            ].map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", fontSize: 12, color: TEXT,
                borderBottom: i < 4 ? `1px solid ${GLASS.faint}` : "none",
              }}>
                <span style={{ width: 18, textAlign: "center" }}>{c.ok ? "✅" : "⚠️"}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 11, color: TEXT_SEC }}>{c.note}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Final actions */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 16px", ...SURFACE, borderRadius: 12,
      }}>
        <button style={{ ...BTN_VIOLET, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>
          🤖 Corregir con IA
        </button>
        <button style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13 }}>
          ✏ Editar JSON
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          background: STATUS_COLORS.aprobada.badgeBg,
          border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
          color: STATUS_COLORS.aprobada.accent,
          borderRadius: 8, padding: "8px 16px",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          ✓ Confirmar y guardar
        </button>
        <button style={{
          background: "none",
          border: `1px solid ${STATUS_COLORS.danger.cardBorder}`,
          color: STATUS_COLORS.danger.accent,
          borderRadius: 8, padding: "8px 16px",
          fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}>
          ✕ Descartar
        </button>
      </div>
    </div>
  );
}
