"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT, STATUS_COLORS, ERROR_PANEL } from "@/lib/ui/tokens";
import { CARD, LABEL } from "./adminTabStyles";
import DiffExportDrawer, { computeDiffs, type DiffItem } from "./DiffExportDrawer";
import GuardarPlanDrawer from "./GuardarPlanDrawer";
import type { ParseResult } from "./DiffExportDrawer";
import { GEMINI_MODELS, DEFAULT_GEMINI_MODEL, type GeminiModelValue, type ModelLimits } from "@/lib/ai/models";
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

type UsageInfo = {
  promptTokens: number | null;
  candidateTokens: number | null;
  totalTokens: number | null;
};

type SourceStatus =
  | { type: "idle" }
  | { type: "loading"; step: ProgressStep; message: string }
  | { type: "error"; message: string }
  | { type: "done"; data: ParseResult };

type ExistingInfo = {
  existe: true;
  materias: number;
  fechaCarga: string;
  fuente: string;
  promptVersion: string | null;
  data: ParseResult;
} | { existe: false };

type ExisteResponse = {
  slug: string;
  parser: ExistingInfo;
  gemini: ExistingInfo;
};

type ConfirmState = {
  fuente: "gemini" | "parser" | "ambos";
  infoParser: ExistingInfo;
  infoGemini: ExistingInfo;
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

export default function CargarPlanTab({ canPublish = true }: { canPublish?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<GeminiModelValue>(DEFAULT_GEMINI_MODEL);
  const [uniType, setUniType] = useState<"uns" | "otra">("uns");
  const [uniNombre, setUniNombre] = useState("");
  const [dragging, setDragging] = useState(false);
  const [statusGemini, setStatusGemini] = useState<SourceStatus>({ type: "idle" });
  const [statusLocal, setStatusLocal] = useState<SourceStatus>({ type: "idle" });
  const [validationOpenGemini, setValidationOpenGemini] = useState(true);
  const [validationOpenLocal, setValidationOpenLocal]   = useState(true);
  const [showFewShot, setShowFewShot] = useState(false);
  const [activeDiffIdx, setActiveDiffIdx] = useState(0);
  const [busquedaMateria, setBusquedaMateria] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [prevGemini, setPrevGemini] = useState<ParseResult | null>(null);
  const [prevLocal, setPrevLocal] = useState<ParseResult | null>(null);
  const [showPrevGemini, setShowPrevGemini] = useState(false);
  const [showPrevLocal, setShowPrevLocal] = useState(false);
  const [usageByModel, setUsageByModel] = useState<Record<string, UsageInfo>>({});
  const { usage: dailyUsage, refresh: refreshDailyUsage } = useDailyUsage();

  const systemPromptRef = useRef<string>("");
  useEffect(() => {
    fetch("/api/admin/planes/parsear")
      .then(r => r.ok ? r.json() : null)
      .then((body: { systemPrompt?: string } | null) => {
        if (body?.systemPrompt) systemPromptRef.current = body.systemPrompt;
      })
      .catch(() => {});
  }, []);

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

  function scrollToMateria(id: string) {
    for (const ref of [scrollRefLocal, scrollRefGemini]) {
      if (!ref.current) continue;
      const el = ref.current.querySelector(`[data-materia-id="${id}"]`) as HTMLElement | null;
      if (el) ref.current.scrollTop = el.offsetTop - ref.current.clientHeight / 3;
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
      const isGemini = endpoint.includes("/parsear") && !endpoint.includes("parsear-local");
      const isLocal = endpoint.includes("parsear-local");

      // En prod, el browser llama directo a Render para evitar el límite de tiempo de Vercel
      const parserApiUrl = process.env.NEXT_PUBLIC_PARSER_API_URL;
      const url = parserApiUrl && isGemini ? `${parserApiUrl}/parse-gemini`
        : parserApiUrl && isLocal  ? `${parserApiUrl}/parse`
        : endpoint;

      const res = await fetch(url, { method: "POST", body: fd });

      const contentType = res.headers.get("content-type") ?? "";

      // Gemini devuelve JSON directo (Vercel no soporta SSE real)
      if (contentType.includes("application/json")) {
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          setStatus({ type: "error", message: `Error ${res.status} del servidor: ${body.slice(0, 200) || res.statusText}` });
          return;
        }
        const event = await res.json() as { type: string; data?: ParseResult; message?: string; model?: string; usage?: UsageInfo };
        if (event.type === "done" && event.data) {
          setStatus({ type: "done", data: event.data });
          if (event.model && event.usage) {
            const u = event.usage;
            setUsageByModel(prev => ({ ...prev, [event.model as string]: u }));
            if (u.totalTokens) { addTokens(event.model as string, u.totalTokens); refreshDailyUsage(); }
          }
        } else {
          setStatus({ type: "error", message: event.message ?? "Error desconocido" });
        }
        return;
      }

      // Si no es JSON ni SSE (ej: HTML de error 504/502 de Vercel)
      if (!contentType.includes("text/event-stream")) {
        const body = await res.text().catch(() => "");
        setStatus({ type: "error", message: `Error inesperado del servidor (${res.status}): ${body.slice(0, 200) || res.statusText}` });
        return;
      }

      // Parser local devuelve SSE
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
              if (event.model && event.usage) {
                const u = event.usage as UsageInfo;
                setUsageByModel(prev => ({ ...prev, [event.model as string]: u }));
                if (u.totalTokens) { addTokens(event.model as string, u.totalTokens); refreshDailyUsage(); }
              }
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

  function ejecutarParseo(fuente: "gemini" | "parser" | "ambos") {
    if (!file) return;
    if (fuente === "gemini" || fuente === "ambos") {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("model", model);
      if (systemPromptRef.current) fd.append("system_prompt", systemPromptRef.current);
      parsearSSE("/api/admin/planes/parsear", fd, "leyendo", setStatusGemini);
    }
    if (fuente === "parser" || fuente === "ambos") {
      const fd = new FormData();
      fd.append("file", file);
      parsearSSE("/api/admin/planes/parsear-local", fd, "guardando", setStatusLocal);
    }
  }

  async function chequearYParsear(fuente: "gemini" | "parser" | "ambos") {
    if (!file) return;
    const res = await fetch(`/api/admin/planes/existe?filename=${encodeURIComponent(file.name)}`);
    if (!res.ok) { ejecutarParseo(fuente); return; }
    const info = await res.json() as ExisteResponse;

    const hayGemini = fuente !== "parser" && info.gemini.existe;
    const hayParser = fuente !== "gemini" && info.parser.existe;

    if (hayGemini || hayParser) {
      if (hayGemini && info.gemini.existe) setPrevGemini((info.gemini as Extract<ExistingInfo, { existe: true }>).data);
      if (hayParser && info.parser.existe) setPrevLocal((info.parser as Extract<ExistingInfo, { existe: true }>).data);
      setConfirmState({ fuente, infoGemini: info.gemini, infoParser: info.parser });
    } else {
      ejecutarParseo(fuente);
    }
  }

  function confirmarParseo() {
    if (!confirmState) return;
    setConfirmState(null);
    ejecutarParseo(confirmState.fuente);
  }

  function parsear() { chequearYParsear("gemini"); }
  function parsearLocal() { chequearYParsear("parser"); }
  function parsearAmbos() { chequearYParsear("ambos"); }

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
            <ModelSelector model={model} onSelect={setModel} usageByModel={usageByModel} dailyUsage={dailyUsage} />
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
            disabled={!file && statusGemini.type === "idle" && statusLocal.type === "idle"}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500,
              opacity: !file && statusGemini.type === "idle" && statusLocal.type === "idle" ? 0.4 : 1,
              cursor: !file && statusGemini.type === "idle" && statusLocal.type === "idle" ? "not-allowed" : "pointer",
            }}
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
        const todasMaterias = (resultadoLocal ?? resultadoGemini)?.materias ?? [];
        const busquedaNorm = busquedaMateria.trim().toLowerCase();
        const sugerencias = busquedaNorm.length >= 1
          ? todasMaterias.filter(m =>
              m.id.toLowerCase().includes(busquedaNorm) ||
              m.nombre?.toLowerCase().includes(busquedaNorm)
            ).slice(0, 6)
          : [];

        return (
          <div>
            {/* Buscador de materia */}
            <div style={{ position: "relative", marginBottom: 10 }}>
              <input
                value={busquedaMateria}
                onChange={e => setBusquedaMateria(e.target.value)}
                placeholder="Buscar materia por ID o nombre…"
                style={{
                  ...INPUT, width: "100%", boxSizing: "border-box",
                  borderRadius: 8, padding: "7px 12px", fontSize: 12,
                }}
              />
              {sugerencias.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  ...SURFACE, borderRadius: 8, marginTop: 4,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}>
                  {sugerencias.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { scrollToMateria(m.id); setBusquedaMateria(""); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", background: "none", border: "none",
                        padding: "8px 12px", cursor: "pointer", textAlign: "left",
                        borderBottom: `1px solid ${GLASS.border}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = GLASS.soft)}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: TEXT_SEC, minWidth: 44 }}>{m.id}</span>
                      <span style={{ fontSize: 11, color: TEXT }}>{m.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                  canPublish={canPublish}
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
                  canPublish={canPublish}
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

            {/* Comparar con versión anterior */}
            {(prevGemini || prevLocal) && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {prevLocal && resultadoLocal && (
                  <button
                    onClick={() => setShowPrevLocal(v => !v)}
                    style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}
                  >
                    🕓 {showPrevLocal ? "Ocultar" : "Comparar con versión anterior"} (parser local)
                  </button>
                )}
                {prevGemini && resultadoGemini && (
                  <button
                    onClick={() => setShowPrevGemini(v => !v)}
                    style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}
                  >
                    🕓 {showPrevGemini ? "Ocultar" : "Comparar con versión anterior"} (Gemini)
                  </button>
                )}
              </div>
            )}

            {showPrevLocal && prevLocal && resultadoLocal && (
              <CompararConAnterior
                label="⚙️ Parser local"
                anterior={prevLocal}
                nuevo={resultadoLocal}
                onClose={() => setShowPrevLocal(false)}
              />
            )}
            {showPrevGemini && prevGemini && resultadoGemini && (
              <CompararConAnterior
                label="🤖 Gemini"
                anterior={prevGemini}
                nuevo={resultadoGemini}
                onClose={() => setShowPrevGemini(false)}
              />
            )}
          </div>
        );
      })()}

      {/* Modal de confirmación */}
      {confirmState && (
        <ModalConfirmar
          fuente={confirmState.fuente}
          infoGemini={confirmState.infoGemini}
          infoParser={confirmState.infoParser}
          onConfirmar={confirmarParseo}
          onCancelar={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}

const LS_KEY = "gemini_token_usage";

type DailyUsage = {
  date: string; // YYYY-MM-DD
  byModel: Record<string, { total: number; requests: number }>;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { date: todayStr(), byModel: {} };
    const parsed: DailyUsage = JSON.parse(raw);
    if (parsed.date !== todayStr()) return { date: todayStr(), byModel: {} };
    return parsed;
  } catch {
    return { date: todayStr(), byModel: {} };
  }
}

function addTokens(modelValue: string, tokens: number) {
  const usage = loadDailyUsage();
  const entry = usage.byModel[modelValue] ?? { total: 0, requests: 0 };
  usage.byModel[modelValue] = { total: entry.total + tokens, requests: entry.requests + 1 };
  try { localStorage.setItem(LS_KEY, JSON.stringify(usage)); } catch {}
}

function useDailyUsage() {
  const [usage, setUsage] = useState<DailyUsage>({ date: todayStr(), byModel: {} });
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUsage(loadDailyUsage()); }, []);
  const refresh = () => setUsage(loadDailyUsage());
  return { usage, refresh };
}

function fmt(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : String(n);
}

function ModelSelector({
  model,
  onSelect,
  usageByModel,
  dailyUsage,
}: {
  model: GeminiModelValue;
  onSelect: (v: GeminiModelValue) => void;
  usageByModel: Record<string, UsageInfo>;
  dailyUsage: DailyUsage;
}) {
  const [open, setOpen] = useState(false);
  const selected = GEMINI_MODELS.find(m => m.value === model)!;

  const totalHoy = Object.values(dailyUsage.byModel).reduce((s, e) => s + e.total, 0);
  const totalReqs = Object.values(dailyUsage.byModel).reduce((s, e) => s + e.requests, 0);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          ...INPUT, borderRadius: 8, padding: "8px 10px", fontSize: 13,
          width: "100%", textAlign: "left", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <span>{selected.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {totalHoy > 0 && (
            <span style={{ fontSize: 10, color: TEXT_SEC }}>
              {fmt(totalHoy)} tokens hoy
            </span>
          )}
          <span style={{ fontSize: 10, color: TEXT_SEC }}>▼</span>
        </div>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#16213e",
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
          border: `1px solid ${GLASS.border}`,
        }}>
          {totalHoy > 0 && (
            <div style={{
              padding: "8px 14px", borderBottom: `1px solid rgba(255,255,255,0.1)`,
              fontSize: 10, color: TEXT_SEC, display: "flex", gap: 12,
            }}>
              <span>Hoy ({dailyUsage.date})</span>
              <span style={{ color: TEXT }}>{fmt(totalHoy)} tokens totales</span>
              <span>{totalReqs} request{totalReqs !== 1 ? "s" : ""}</span>
            </div>
          )}
          {GEMINI_MODELS.map(m => {
            const isSelected = m.value === model;
            const lastUsage = usageByModel[m.value] ?? null;
            const dayEntry = dailyUsage.byModel[m.value] ?? null;
            const { rpm, tpm, rpd } = m.limits as ModelLimits;
            return (
              <button
                key={m.value}
                onClick={() => { onSelect(m.value as GeminiModelValue); setOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 14px", background: isSelected ? "rgba(157,78,221,0.2)" : "transparent",
                  border: "none", borderBottom: `1px solid rgba(255,255,255,0.06)`,
                  cursor: "pointer", color: TEXT,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400 }}>{m.label}</span>
                  {isSelected && <span style={{ fontSize: 10, color: ACCENT }}>✓</span>}
                </div>
                <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 4, display: "flex", gap: 10 }}>
                  <span title="Requests por minuto">{rpm} RPM</span>
                  <span title="Tokens por minuto">{fmt(tpm)} TPM</span>
                  <span title="Requests por día">{fmt(rpd)} RPD</span>
                </div>
                {(() => {
                  const used = dayEntry?.requests ?? 0;
                  const pct = Math.min(used / rpd, 1);
                  const barColor = pct >= 1 ? "#ef4444" : pct >= 0.8 ? "#f59e0b" : "#22c55e";
                  return (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: TEXT_SEC, marginBottom: 3 }}>
                        <span>{used} / {fmt(rpd)} req hoy</span>
                        {lastUsage?.totalTokens != null && (
                          <span>último: {fmt(lastUsage.totalTokens)} tokens</span>
                        )}
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${pct * 100}%`,
                          background: barColor,
                          transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                  );
                })()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModalConfirmar({
  fuente,
  infoGemini,
  infoParser,
  onConfirmar,
  onCancelar,
}: {
  fuente: "gemini" | "parser" | "ambos";
  infoGemini: ExistingInfo;
  infoParser: ExistingInfo;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const filas: { label: string; info: ExistingInfo }[] = [];
  if (fuente !== "parser" && infoGemini.existe) filas.push({ label: "🤖 Gemini", info: infoGemini });
  if (fuente !== "gemini" && infoParser.existe) filas.push({ label: "⚙️ Parser local", info: infoParser });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        ...SURFACE, borderRadius: 14, padding: "28px 32px",
        maxWidth: 460, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>⚠️</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 8 }}>
          Ya existe un JSON generado
        </h2>
        <p style={{ fontSize: 13, color: TEXT_SEC, marginBottom: 16, lineHeight: 1.5 }}>
          Regenerar reemplazará el archivo actual. ¿Querés continuar?
        </p>

        {filas.map(({ label, info }) => info.existe && (
          <div key={label} style={{
            background: GLASS.elevated, border: `1px solid ${GLASS.border}`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 10,
            fontSize: 12, color: TEXT_SEC,
          }}>
            <div style={{ fontWeight: 600, color: TEXT, marginBottom: 4 }}>{label}</div>
            <div>{info.materias} materias · guardado {info.fechaCarga}</div>
            <div>fuente: {info.fuente}{info.promptVersion ? ` · ${info.promptVersion}` : ""}</div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onConfirmar}
            style={{
              flex: 1, ...BTN_VIOLET, borderRadius: 8,
              padding: "9px 0", fontSize: 13, fontWeight: 600,
            }}
          >
            Sí, regenerar
          </button>
          <button
            onClick={onCancelar}
            style={{
              flex: 1, ...BTN, borderRadius: 8,
              padding: "9px 0", fontSize: 13, fontWeight: 500,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ColHeader({ label, json, copied, onCopy }: { label: string; json: unknown; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 14px", background: GLASS.elevated,
      borderBottom: `1px solid ${GLASS.border}`,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
        {label}
      </span>
      <button
        onClick={onCopy}
        disabled={!json}
        style={{
          ...BTN, borderRadius: 6, padding: "3px 8px", fontSize: 10,
          display: "flex", alignItems: "center", gap: 3,
          background: copied ? "rgba(34,197,94,0.15)" : undefined,
          color: copied ? "#22c55e" : TEXT_SEC,
          transition: "background 0.2s",
        }}
      >
        {copied ? "✓ Copiado" : "📋 Copiar"}
      </button>
    </div>
  );
}

function CompararConAnterior({
  label,
  anterior,
  nuevo,
  onClose,
}: {
  label: string;
  anterior: ParseResult;
  nuevo: ParseResult;
  onClose: () => void;
}) {
  const diffs = useMemo(() => computeDiffs(anterior, nuevo), [anterior, nuevo]);
  const [idx, setIdx] = useState(0);
  const diffIds = useMemo(() => [...new Set(diffs.map(d => d.id))], [diffs]);
  const activeDiffId = diffIds[idx] ?? null;

  const scrollRefAnterior = useRef<HTMLDivElement | null>(null);
  const scrollRefNuevo = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);
  const [copiedAnterior, setCopiedAnterior] = useState(false);
  const [copiedNuevo, setCopiedNuevo] = useState(false);

  function copiar(json: ParseResult, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleScroll(source: "anterior" | "nuevo") {
    return (e: React.UIEvent<HTMLDivElement>) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      const target = source === "anterior" ? scrollRefNuevo.current : scrollRefAnterior.current;
      if (target) target.scrollTop = (e.target as HTMLDivElement).scrollTop;
      syncingRef.current = false;
    };
  }

  return (
    <div style={{ marginTop: 16, ...SURFACE, borderRadius: 12, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", borderBottom: `1px solid ${GLASS.border}`,
        background: GLASS.elevated,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
          🕓 {label} — versión anterior vs nueva
        </span>
        {diffIds.length > 0 && (
          <span style={{ fontSize: 11, color: TEXT_SEC }}>
            {diffIds.length} diferencia{diffIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {diffIds.length === 0 && (
          <span style={{ fontSize: 11, color: "#22c55e" }}>sin diferencias</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {diffIds.length > 0 && (
            <>
              <button
                onClick={() => setIdx(i => Math.max(0, i - 1))}
                disabled={idx === 0}
                style={{ ...BTN, borderRadius: 6, padding: "3px 8px", fontSize: 11, opacity: idx === 0 ? 0.4 : 1 }}
              >← Anterior</button>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>{idx + 1}/{diffIds.length}</span>
              <button
                onClick={() => setIdx(i => Math.min(diffIds.length - 1, i + 1))}
                disabled={idx >= diffIds.length - 1}
                style={{ ...BTN, borderRadius: 6, padding: "3px 8px", fontSize: 11, opacity: idx >= diffIds.length - 1 ? 0.4 : 1 }}
              >Siguiente →</button>
            </>
          )}
          <button
            onClick={onClose}
            style={{ ...BTN, borderRadius: 6, padding: "3px 10px", fontSize: 12 }}
          >✕</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minWidth: 0 }}>
        <div style={{ borderRight: `1px solid ${GLASS.border}`, minWidth: 0, overflow: "hidden" }}>
          <ColHeader label="Anterior" json={anterior} copied={copiedAnterior} onCopy={() => copiar(anterior, setCopiedAnterior)} />
          <JsonViewer ref={scrollRefAnterior} json={anterior} diffs={diffs} fuente="parser" activeDiffId={activeDiffId} onScroll={handleScroll("anterior")} />
        </div>
        <div style={{ minWidth: 0, overflow: "hidden" }}>
          <ColHeader label="Nuevo" json={nuevo} copied={copiedNuevo} onCopy={() => copiar(nuevo, setCopiedNuevo)} />
          <JsonViewer ref={scrollRefNuevo} json={nuevo} diffs={diffs} fuente="gemini" activeDiffId={activeDiffId} onScroll={handleScroll("nuevo")} />
        </div>
      </div>
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
  canPublish: boolean;
};

function ColumnaResultado({
  label, fuente, data, ground, elapsed, loading,
  validationOpen, onToggleValidation, diffCount,
  diffs, activeDiffId, scrollRef, onScroll, canPublish,
}: ColumnaProps) {
  const conf = data._llm_confidence != null ? Math.round(data._llm_confidence * 100) : null;
  const [guardarFuente, setGuardarFuente] = useState<"gemini" | "parser" | null>(null);
  const [revisionAbierta, setRevisionAbierta] = useState(false);
  const [revisionNota, setRevisionNota] = useState("");
  const [revisionState, setRevisionState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [borradorState, setBorradorState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");

  const ids = data.materias.map(m => m.id);
  const uniqueIds = new Set(ids);
  const duplicados = ids.length - uniqueIds.size;
  const sinAño = data.materias.filter(m => !m.año).length;
  const todasLasIds = new Set([...ids, ...data.agrupadores.map((a: unknown) => (a as { id?: string }).id).filter(Boolean)]);
  const brokenIds = new Set(
    data.materias.flatMap(m => Object.keys(m.correlativas).filter(cid => !todasLasIds.has(cid)))
  );
  const correlativasRotas = brokenIds.size;
  const tieneCarrera = !!data.plan.carrera && !!data.plan.universidad && !!data.plan.codigo_plan;

  const checks = [
    { ok: tieneCarrera,            critico: true,  label: "Campos del plan",      note: tieneCarrera ? `${data.plan.carrera}` : "Falta carrera, universidad o código" },
    { ok: duplicados === 0,        critico: true,  label: "IDs únicos",           note: duplicados === 0 ? `${ids.length} materias` : `${duplicados} duplicado${duplicados > 1 ? "s" : ""}` },
    { ok: sinAño === 0,            critico: false, label: "Año asignado",         note: sinAño === 0 ? "Todas tienen año" : `${sinAño} sin año` },
    { ok: correlativasRotas === 0, critico: true,  label: "Correlativas válidas", note: correlativasRotas === 0 ? "Todas las IDs existen" : `${correlativasRotas} ID${correlativasRotas > 1 ? "s" : ""} no encontrada${correlativasRotas > 1 ? "s" : ""}` },
    { ok: data.agrupadores.length > 0, critico: false, label: "Agrupadores",     note: `${data.agrupadores.length} grupo${data.agrupadores.length !== 1 ? "s" : ""}` },
  ];

  const hayErroresCriticos = checks.some(c => c.critico && !c.ok);
  const [copied, setCopied] = useState(false);

  function copyJSON() {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <ColHeader label="{ } JSON generado" json={data} copied={copied} onCopy={copyJSON} />
        <JsonViewer
          ref={scrollRef}
          json={data}
          diffs={diffs}
          fuente={fuente}
          activeDiffId={activeDiffId}
          onScroll={onScroll}
          brokenIds={brokenIds}
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
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${GLASS.border}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {canPublish && (borradorState === "conflict" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#f59e0b" }}>Ya existe un borrador. ¿Sobreescribir?</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => setBorradorState("idle")}
                style={{ ...BTN, flex: 1, borderRadius: 6, padding: "5px 0", fontSize: 11, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setBorradorState("saving");
                  try {
                    const res = await fetch("/api/admin/planes/guardar", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan: data, fuente, publicar: false, resolucion: "reemplazar" }),
                    });
                    const d = await res.json();
                    setBorradorState(d.ok ? "saved" : "error");
                  } catch {
                    setBorradorState("error");
                  }
                }}
                style={{
                  flex: 1, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)",
                  color: "#f59e0b", borderRadius: 6, padding: "5px 0",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                Sobreescribir
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={async () => {
              setBorradorState("saving");
              try {
                const res = await fetch("/api/admin/planes/guardar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan: data, fuente, publicar: false, resolucion: null }),
                });
                const d = await res.json();
                if (d.conflict) setBorradorState("conflict");
                else setBorradorState(d.ok ? "saved" : "error");
              } catch {
                setBorradorState("error");
              }
            }}
            disabled={borradorState === "saving" || borradorState === "saved"}
            style={{
              width: "100%",
              background: borradorState === "saved" ? STATUS_COLORS.aprobada.badgeBg : GLASS.elevated,
              border: `1px solid ${borradorState === "saved" ? STATUS_COLORS.aprobada.badgeBorder : borradorState === "error" ? "rgba(248,113,113,0.4)" : GLASS.border}`,
              color: borradorState === "saved" ? STATUS_COLORS.aprobada.accent : borradorState === "error" ? "#f87171" : TEXT_SEC,
              borderRadius: 8, padding: "6px 0",
              fontSize: 12, fontWeight: 500,
              cursor: borradorState === "saving" || borradorState === "saved" ? "not-allowed" : "pointer",
              opacity: borradorState === "saving" ? 0.6 : 1,
            }}
          >
            {borradorState === "saving" ? "Guardando…"
              : borradorState === "saved" ? `✓ Borrador guardado en data/${fuente === "gemini" ? "gemini" : "local"}/`
              : borradorState === "error" ? "Error al guardar"
              : `💾 Guardar borrador en ${fuente === "gemini" ? "Gemini" : "local"}`}
          </button>
        ))}
        {canPublish ? (
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
        ) : (
          <button
            onClick={() => { setRevisionAbierta(v => !v); setRevisionState("idle"); }}
            disabled={hayErroresCriticos}
            title={hayErroresCriticos ? "Corregí los errores críticos antes de enviar" : undefined}
            style={{
              width: "100%",
              background: hayErroresCriticos ? GLASS.elevated : "rgba(245,158,11,0.12)",
              border: `1px solid ${hayErroresCriticos ? GLASS.border : "rgba(245,158,11,0.35)"}`,
              color: hayErroresCriticos ? TEXT_SEC : "#f59e0b",
              borderRadius: 8, padding: "8px 0",
              fontSize: 13, fontWeight: 600, cursor: hayErroresCriticos ? "not-allowed" : "pointer",
              opacity: hayErroresCriticos ? 0.5 : 1,
            }}
          >
            ⏳ Enviar a revisión
          </button>
        )}
      </div>

      {!canPublish && revisionAbierta && (
        <div style={{
          margin: "0 14px 14px",
          background: GLASS.elevated, border: `1px solid ${GLASS.border}`,
          borderRadius: 10, padding: "14px 16px",
        }}>
          {revisionState === "sent" ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>Plan enviado a revisión</div>
              <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 4 }}>Un administrador lo revisará en el Historial.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: TEXT_SEC, fontWeight: 500, marginBottom: 8 }}>
                Nota para el administrador (opcional)
              </div>
              <textarea
                rows={3}
                placeholder="Describí brevemente el plan o alguna observación…"
                value={revisionNota}
                onChange={e => setRevisionNota(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${GLASS.border}`,
                  borderRadius: 8, padding: "8px 10px", color: TEXT,
                  fontSize: 12, resize: "vertical", fontFamily: "inherit",
                }}
              />
              {revisionState === "error" && (
                <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 6 }}>No se pudo enviar. Intentá de nuevo.</div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  disabled={revisionState === "sending"}
                  onClick={async () => {
                    setRevisionState("sending");
                    try {
                      const res = await fetch("/api/admin/planes/enviar-revision", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ plan: data, fuente, nota: revisionNota }),
                      });
                      setRevisionState(res.ok ? "sent" : "error");
                    } catch {
                      setRevisionState("error");
                    }
                  }}
                  style={{
                    background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)",
                    color: "#f59e0b", borderRadius: 8, padding: "7px 16px",
                    fontSize: 12, fontWeight: 600, cursor: revisionState === "sending" ? "not-allowed" : "pointer",
                    opacity: revisionState === "sending" ? 0.6 : 1,
                  }}
                >
                  {revisionState === "sending" ? "Enviando…" : "Confirmar envío"}
                </button>
                <button
                  onClick={() => setRevisionAbierta(false)}
                  style={{
                    background: "none", border: `1px solid ${GLASS.border}`,
                    color: TEXT_SEC, borderRadius: 8, padding: "7px 14px",
                    fontSize: 12, cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
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

