"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT, STATUS_COLORS, ERROR_PANEL } from "@/lib/ui/tokens";
import DiffExportDrawer, { computeDiffs, type DiffItem } from "./DiffExportDrawer";
import GuardarPlanDrawer from "./GuardarPlanDrawer";
import type { ParseResult } from "./DiffExportDrawer";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";
import JsonViewer from "../JsonViewer";

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

type SourceStatus =
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

function useElapsedTime(status: SourceStatus): number | null {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status.type === "loading") {
      startRef.current = Date.now();
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
      }, 500);
      return () => clearInterval(id);
    }
    if ((status.type === "done" || status.type === "error") && startRef.current !== null) {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      startRef.current = null;
    }
    if (status.type === "idle") {
      setElapsed(null);
      startRef.current = null;
    }
  }, [status.type]);

  return elapsed;
}

export default function CargarPlanTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(DEFAULT_GEMINI_MODEL);
  const [dryRun, setDryRun] = useState(false);
  const [uniType, setUniType] = useState<"uns" | "otra">("uns");
  const [uniNombre, setUniNombre] = useState("");
  const [dragging, setDragging] = useState(false);
  const [statusGemini, setStatusGemini] = useState<SourceStatus>({ type: "idle" });
  const [statusLocal, setStatusLocal] = useState<SourceStatus>({ type: "idle" });
  const [validationOpenGemini, setValidationOpenGemini] = useState(true);
  const [validationOpenLocal, setValidationOpenLocal]   = useState(true);
  const [showFewShot, setShowFewShot] = useState(false);
  const [activeDiffIdx, setActiveDiffIdx] = useState(0);

  const resultadoGemini = statusGemini.type === "done" ? statusGemini.data : null;
  const resultadoLocal  = statusLocal.type  === "done" ? statusLocal.data  : null;
  const hayLoading = statusGemini.type === "loading" || statusLocal.type === "loading";

  const elapsedGemini = useElapsedTime(statusGemini);
  const elapsedLocal  = useElapsedTime(statusLocal);

  const scrollRefLocal  = useRef<HTMLDivElement | null>(null);
  const scrollRefGemini = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const computedDiffs = useMemo(
    () => resultadoLocal && resultadoGemini
      ? computeDiffs(resultadoLocal, resultadoGemini)
      : [],
    [resultadoLocal, resultadoGemini],
  );
  const diffIds = useMemo(
    () => [...new Set(computedDiffs.map(d => d.id))],
    [computedDiffs],
  );
  const activeDiffId = diffIds[activeDiffIdx] ?? null;

  function handleScroll(source: "local" | "gemini") {
    return (e: React.UIEvent<HTMLDivElement>) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const target = source === "local" ? scrollRefGemini.current : scrollRefLocal.current;
      if (target) target.scrollTop = (e.target as HTMLDivElement).scrollTop;
      syncingRef.current = false;
    };
  }

  function scrollToActiveDiff(id: string) {
    for (const ref of [scrollRefLocal, scrollRefGemini]) {
      if (!ref.current) continue;
      const el = ref.current.querySelector(`[data-diff-id="${id}"]`) as HTMLElement | null;
      if (el) {
        const container = ref.current;
        container.scrollTop = el.offsetTop - container.clientHeight / 2;
      }
    }
  }

  function navegarDiff(delta: number) {
    const next = Math.max(0, Math.min(diffIds.length - 1, activeDiffIdx + delta));
    setActiveDiffIdx(next);
    if (diffIds[next]) scrollToActiveDiff(diffIds[next]);
  }

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") return;
    setFile(f);
    setStatusGemini({ type: "idle" });
    setStatusLocal({ type: "idle" });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function parsearSSE(
    endpoint: string,
    fd: FormData,
    initialStep: ProgressStep,
    setStatus: React.Dispatch<React.SetStateAction<SourceStatus>>,
  ) {
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
              setStatus({ type: "done", data: event.data as ParseResult });
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
    parsearSSE("/api/admin/planes/parsear", fd, "leyendo", setStatusGemini);
  }

  function parsearLocal() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    parsearSSE("/api/admin/planes/parsear-local", fd, "guardando", setStatusLocal);
  }

  function parsearAmbos() {
    if (!file) return;
    const fdGemini = new FormData();
    fdGemini.append("file", file);
    fdGemini.append("model", model);
    const fdLocal = new FormData();
    fdLocal.append("file", file);
    parsearSSE("/api/admin/planes/parsear", fdGemini, "leyendo", setStatusGemini);
    parsearSSE("/api/admin/planes/parsear-local", fdLocal, "guardando", setStatusLocal);
  }

  function limpiar() {
    setFile(null);
    setStatusGemini({ type: "idle" });
    setStatusLocal({ type: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const kb = file ? (file.size / 1024).toFixed(1) : null;

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
            disabled={!file || hayLoading}
            style={{
              ...BTN_VIOLET, borderRadius: 8, padding: "8px 18px",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: !file || hayLoading ? 0.5 : 1,
              cursor: !file || hayLoading ? "not-allowed" : "pointer",
            }}
          >
            <span>🤖</span>
            {statusGemini.type === "loading" ? statusGemini.message : "Gemini"}
          </button>
          <button
            onClick={parsearLocal}
            disabled={!file || hayLoading}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: !file || hayLoading ? 0.5 : 1,
              cursor: !file || hayLoading ? "not-allowed" : "pointer",
            }}
          >
            <span>⚙️</span>
            {statusLocal.type === "loading" ? statusLocal.message : "Parser local"}
          </button>
          <button
            onClick={parsearAmbos}
            disabled={!file || hayLoading}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
              opacity: !file || hayLoading ? 0.5 : 1,
              cursor: !file || hayLoading ? "not-allowed" : "pointer",
              borderColor: ACCENT,
            }}
          >
            <span>⚡</span>
            Ambos
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

        {hayLoading && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {([
              { label: "🤖 Gemini", status: statusGemini, steps: STEP_LABELS_GEMINI, elapsed: elapsedGemini },
              { label: "⚙️ Parser local", status: statusLocal, steps: STEP_LABELS_LOCAL, elapsed: elapsedLocal },
            ] as const).map(({ label, status, steps, elapsed }) =>
              status.type === "loading" ? (
                <div key={label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 600, color: TEXT_SEC, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                    {label}
                    {elapsed !== null && (
                      <span style={{ fontWeight: 400, color: ACCENT, letterSpacing: 0 }}>{elapsed}s</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {steps.map((step, i) => {
                      const currentIdx = status.type === "loading" ? steps.indexOf(status.step) : -1;
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
                          {isActive && <span style={{ marginLeft: 2, color: ACCENT, fontSize: 11 }}>●</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Errores */}
      {statusGemini.type === "error" && (
        <div style={{ ...ERROR_PANEL, borderRadius: 10, padding: "12px 16px", marginBottom: 8, fontSize: 13 }}>
          ⚠ Gemini: {statusGemini.message}
        </div>
      )}
      {statusLocal.type === "error" && (
        <div style={{ ...ERROR_PANEL, borderRadius: 10, padding: "12px 16px", marginBottom: 8, fontSize: 13 }}>
          ⚠ Parser local: {statusLocal.message}
        </div>
      )}

      {/* Resultados */}
      {(resultadoGemini || resultadoLocal) && (() => {
        const ambos = !!(resultadoGemini && resultadoLocal);
        const diffCount = ambos ? computedDiffs.length : undefined;
        return (
          <div>
            {/* Barra de navegación de diffs */}
            {ambos && diffIds.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 10, padding: "8px 14px",
                ...SURFACE, borderRadius: 8,
              }}>
                <span style={{ fontSize: 11, color: TEXT_SEC }}>
                  Diferencia <strong style={{ color: TEXT }}>{activeDiffIdx + 1}</strong> de <strong style={{ color: TEXT }}>{diffIds.length}</strong>
                  {activeDiffId && <span style={{ color: TEXT_SEC }}> — {computedDiffs.find(d => d.id === activeDiffId)?.nombre}</span>}
                </span>
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button
                    onClick={() => navegarDiff(-1)}
                    disabled={activeDiffIdx === 0}
                    style={{ ...BTN, borderRadius: 6, padding: "4px 10px", fontSize: 11, opacity: activeDiffIdx === 0 ? 0.4 : 1 }}
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => navegarDiff(1)}
                    disabled={activeDiffIdx >= diffIds.length - 1}
                    style={{ ...BTN, borderRadius: 6, padding: "4px 10px", fontSize: 11, opacity: activeDiffIdx >= diffIds.length - 1 ? 0.4 : 1 }}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

            <div style={{
              display: "grid",
              gridTemplateColumns: ambos ? "1fr 1fr" : "1fr",
              gap: 16,
              alignItems: "start",
            }}>
              {resultadoLocal && (
                <ColumnaResultado
                  label="⚙️ Parser local"
                  fuente="parser"
                  data={resultadoLocal}
                  ground={resultadoGemini}
                  elapsed={elapsedLocal}
                  loading={statusGemini.type === "loading"}
                  validationOpen={validationOpenLocal}
                  onToggleValidation={() => setValidationOpenLocal(v => !v)}
                  diffCount={diffCount}
                  diffs={computedDiffs}
                  activeDiffId={activeDiffId}
                  scrollRef={scrollRefLocal}
                  onScroll={handleScroll("local")}
                />
              )}
              {resultadoGemini && (
                <ColumnaResultado
                  label="🤖 Gemini"
                  fuente="gemini"
                  data={resultadoGemini}
                  ground={resultadoLocal}
                  elapsed={elapsedGemini}
                  loading={statusLocal.type === "loading"}
                  validationOpen={validationOpenGemini}
                  onToggleValidation={() => setValidationOpenGemini(v => !v)}
                  diffCount={diffCount}
                  diffs={computedDiffs}
                  activeDiffId={activeDiffId}
                  scrollRef={scrollRefGemini}
                  onScroll={handleScroll("gemini")}
                />
              )}
            </div>

            {ambos && (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowFewShot(v => !v)}
                  style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}
                >
                  🧪 {showFewShot ? "Cerrar few-shot" : "Exportar diff como few-shot"}
                </button>
              </div>
            )}

            {showFewShot && resultadoGemini && (
              <DiffExportDrawer
                gemini={resultadoGemini}
                ground={resultadoLocal}
                onClose={() => setShowFewShot(false)}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}

type ColumnaProps = {
  label: string;
  fuente: "gemini" | "parser";
  data: ParseResult;
  ground: ParseResult | null;
  elapsed: number | null;
  loading: boolean;
  validationOpen: boolean;
  onToggleValidation: () => void;
  diffCount?: number;
  diffs: DiffItem[];
  activeDiffId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
};

function ColumnaResultado({
  label, fuente, data, ground, elapsed, loading,
  validationOpen, onToggleValidation, diffCount,
  diffs, activeDiffId, scrollRef, onScroll,
}: ColumnaProps) {
  const conf = data._llm_confidence != null ? Math.round(data._llm_confidence * 100) : null;
  const [guardarFuente, setGuardarFuente] = useState<"gemini" | "parser" | null>(null);

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
    { ok: tieneCarrera,            critico: true,  label: "Campos del plan",      note: tieneCarrera ? `${data.plan.carrera}` : "Falta carrera, universidad o código" },
    { ok: duplicados === 0,        critico: true,  label: "IDs únicos",           note: duplicados === 0 ? `${ids.length} materias` : `${duplicados} duplicado${duplicados > 1 ? "s" : ""}` },
    { ok: sinAño === 0,            critico: false, label: "Año asignado",         note: sinAño === 0 ? "Todas tienen año" : `${sinAño} sin año` },
    { ok: correlativasRotas === 0, critico: true,  label: "Correlativas válidas", note: correlativasRotas === 0 ? "Todas las IDs existen" : `${correlativasRotas} ID${correlativasRotas > 1 ? "s" : ""} no encontrada${correlativasRotas > 1 ? "s" : ""}` },
    { ok: data.agrupadores.length > 0, critico: false, label: "Agrupadores",     note: `${data.agrupadores.length} grupo${data.agrupadores.length !== 1 ? "s" : ""}` },
  ];

  const hayErroresCriticos = checks.some(c => c.critico && !c.ok);

  function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{ ...SURFACE, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: `1px solid ${GLASS.border}`,
        background: GLASS.elevated, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>{label}</span>
        {elapsed !== null && (
          <span style={{ fontSize: 11, color: TEXT_SEC }}>{elapsed}s</span>
        )}
        {conf != null && (
          <span style={{
            background: STATUS_COLORS.aprobada.badgeBg,
            border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
            color: STATUS_COLORS.aprobada.accent,
            borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 600,
          }}>
            {conf}% confianza
          </span>
        )}
        {loading && (
          <span style={{ fontSize: 11, color: ACCENT }}>⏳ procesando…</span>
        )}
        {diffCount !== undefined && diffCount > 0 && (
          <span style={{
            marginLeft: "auto",
            background: "rgba(249,199,79,0.15)", border: "1px solid rgba(249,199,79,0.4)",
            color: "#f9c74f", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 600,
          }}>
            {diffCount} diferencia{diffCount !== 1 ? "s" : ""}
          </span>
        )}
        {diffCount === 0 && ground && (
          <span style={{
            marginLeft: "auto",
            background: STATUS_COLORS.aprobada.badgeBg, border: `1px solid ${STATUS_COLORS.aprobada.badgeBorder}`,
            color: STATUS_COLORS.aprobada.accent, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 600,
          }}>
            sin diferencias
          </span>
        )}
      </div>

      {/* JSON */}
      <div style={{ borderRadius: 0, overflow: "hidden", flex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", borderBottom: `1px solid ${GLASS.border}`,
          background: GLASS.elevated,
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
            {"{ }"} JSON generado
          </span>
          <button
            onClick={copyJSON}
            style={{ ...BTN, borderRadius: 6, padding: "3px 8px", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}
          >
            📋 Copiar
          </button>
        </div>
        <JsonViewer
          ref={scrollRef}
          json={data}
          diffs={diffs}
          fuente={fuente}
          activeDiffId={activeDiffId}
          onScroll={onScroll}
        />
      </div>

      {/* Validación */}
      <div style={{ borderTop: `1px solid ${GLASS.border}`, flexShrink: 0 }}>
        <div
          onClick={onToggleValidation}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", cursor: "pointer" }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: hayErroresCriticos ? "#fca5a5" : TEXT_SEC }}>
            {hayErroresCriticos ? "⛔ Errores" : "✅ Validación"}
          </span>
          <span style={{ color: TEXT_SEC, fontSize: 10, transform: validationOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
        </div>
        {validationOpen && (
          <div style={{ borderTop: `1px solid ${GLASS.border}`, padding: "2px 14px 10px" }}>
            {checks.map((c, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "4px 0", fontSize: 11, color: TEXT,
                borderBottom: i < checks.length - 1 ? `1px solid ${GLASS.faint}` : "none",
              }}>
                <span style={{ width: 16, textAlign: "center", fontSize: 10 }}>{c.ok ? "✅" : c.critico ? "⛔" : "⚠️"}</span>
                <span style={{ flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 10, color: c.ok ? TEXT_SEC : c.critico ? "#fca5a5" : "#fcd34d" }}>{c.note}</span>
              </div>
            ))}
            {hayErroresCriticos && (
              <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(252,165,165,0.08)", border: "1px solid rgba(252,165,165,0.25)", fontSize: 10, color: "#fca5a5" }}>
                ⛔ No se puede guardar hasta resolver los errores críticos.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acción */}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${GLASS.border}`, flexShrink: 0 }}>
        <button
          onClick={() => setGuardarFuente(fuente)}
          disabled={hayErroresCriticos}
          title={hayErroresCriticos ? "Corregí los errores críticos antes de guardar" : undefined}
          style={{
            width: "100%",
            background: hayErroresCriticos ? GLASS.elevated : STATUS_COLORS.aprobada.badgeBg,
            border: `1px solid ${hayErroresCriticos ? GLASS.border : STATUS_COLORS.aprobada.badgeBorder}`,
            color: hayErroresCriticos ? TEXT_SEC : STATUS_COLORS.aprobada.accent,
            borderRadius: 8, padding: "8px 0",
            fontSize: 13, fontWeight: 600, cursor: hayErroresCriticos ? "not-allowed" : "pointer",
            opacity: hayErroresCriticos ? 0.5 : 1,
          }}
        >
          ✓ Usar {fuente === "gemini" ? "Gemini" : "parser local"}
        </button>
      </div>

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

