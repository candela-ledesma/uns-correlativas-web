"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BG_GRADIENT, GLASS, SURFACE, TEXT, TEXT_SEC, BTN, BTN_VIOLET } from "@/lib/ui/tokens";

type ValidacionResult =
  | { tipo: "ok"; output: string; score: number | null }
  | { tipo: "sin_ground_truth" }
  | { tipo: "error"; msg: string };

function extraerScore(output: string): number | null {
  const m = output.match(/SCORE FINAL:\s*([\d.]+)\/100/);
  return m ? parseFloat(m[1]) : null;
}

function scoreColor(score: number): string {
  if (score >= 90) return "#90be6d";
  if (score >= 75) return "#f59e0b";
  return "#f87171";
}

type Materia = { id: string; nombre: string };

function extraerMaterias(raw: string): Materia[] {
  try {
    const obj = JSON.parse(raw);
    const lista: unknown[] = Array.isArray(obj.materias) ? obj.materias : [];
    return lista
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map(m => ({ id: String(m.id ?? ""), nombre: String(m.nombre ?? "") }))
      .filter(m => m.id);
  } catch {
    return [];
  }
}

// Splits json text into segments, highlighting lines that contain the selected id
function buildJsonSegments(json: string, selectedId: string | null): { text: string; highlight: boolean }[] {
  if (!selectedId) return [{ text: json, highlight: false }];
  const lines = json.split("\n");
  const segments: { text: string; highlight: boolean }[] = [];
  let inBlock = false;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIdLine = line.includes(`"id": "${selectedId}"`);

    if (isIdLine) {
      inBlock = true;
      depth = 0;
    }

    if (inBlock) {
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      segments.push({ text: (i < lines.length - 1 ? line + "\n" : line), highlight: true });
      if (depth <= 0 && i > 0) inBlock = false;
    } else {
      const last = segments[segments.length - 1];
      if (last && !last.highlight) {
        last.text += (i < lines.length - 1 ? line + "\n" : line);
      } else {
        segments.push({ text: (i < lines.length - 1 ? line + "\n" : line), highlight: false });
      }
    }
  }

  return segments;
}

export default function RevisionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [validando, setValidando] = useState(false);
  const [validacion, setValidacion] = useState<ValidacionResult | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const jsonRef = useRef<HTMLPreElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    fetch(`/api/admin/planes/pendientes/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.text();
      })
      .then(text => {
        try {
          setJson(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setJson(text);
        }
      })
      .catch(e => setError(e.message));
  }, [slug]);

  // Scroll to highlighted block when selection changes
  useEffect(() => {
    if (!seleccionado) return;
    // Small delay so DOM has rendered the new segments
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(t);
  }, [seleccionado]);

  function copiar() {
    if (!json) return;
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function validar() {
    setValidando(true);
    setValidacion(null);
    try {
      const res = await fetch("/api/admin/planes/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.sinGroundTruth) {
        setValidacion({ tipo: "sin_ground_truth" });
      } else if (data.output) {
        setValidacion({ tipo: "ok", output: data.output, score: extraerScore(data.output) });
      } else {
        setValidacion({ tipo: "error", msg: data.error ?? "Error desconocido" });
      }
    } catch (e) {
      setValidacion({ tipo: "error", msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setValidando(false);
    }
  }

  const materias = json ? extraerMaterias(json) : [];
  const q = busqueda.trim().toLowerCase();
  const filtradas = q
    ? materias.filter(m => m.id.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q))
    : materias;

  const jsonSegments = json ? buildJsonSegments(json, seleccionado) : [];

  function seleccionar(id: string) {
    setSeleccionado(prev => (prev === id ? null : id));
  }

  return (
    <div style={{ background: BG_GRADIENT, minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 28px", height: 52,
        borderBottom: `1px solid ${GLASS.border}`,
        background: "rgba(10,14,40,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 16, opacity: 0.7 }}>⏳</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Revisión pendiente</span>
        <span style={{
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.35)",
          color: "#f59e0b",
          borderRadius: 4, padding: "1px 8px",
          fontSize: 10, fontWeight: 600,
        }}>
          {slug}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={validar}
            disabled={!json || validando}
            style={{
              ...BTN_VIOLET, borderRadius: 8, padding: "4px 14px",
              fontSize: 12, fontWeight: 600,
              opacity: !json || validando ? 0.5 : 1,
              cursor: !json || validando ? "not-allowed" : "pointer",
            }}
          >
            {validando ? "Validando…" : "Validar"}
          </button>
          <button
            onClick={copiar}
            disabled={!json}
            style={{
              ...BTN, borderRadius: 8, padding: "4px 14px",
              fontSize: 12, cursor: json ? "pointer" : "not-allowed",
              opacity: json ? 1 : 0.4,
            }}
          >
            {copied ? "✓ Copiado" : "Copiar JSON"}
          </button>
          <button
            onClick={() => window.close()}
            style={{ ...BTN, borderRadius: 8, padding: "4px 14px", fontSize: 12, cursor: "pointer" }}
          >
            Cerrar
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px 56px", display: "flex", flexDirection: "column", gap: 20 }}>
        {!json && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_SEC, fontSize: 13 }}>Cargando…</div>
        )}
        {error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#f87171", fontSize: 13 }}>{error}</div>
        )}

        {/* ── Panel de validación ── */}
        {validacion && (
          <div style={{
            ...SURFACE, borderRadius: 12, padding: "16px 20px",
            borderColor: validacion.tipo === "ok" && validacion.score != null
              ? scoreColor(validacion.score) + "55"
              : undefined,
          }}>
            {validacion.tipo === "sin_ground_truth" && (
              <div style={{ color: TEXT_SEC, fontSize: 13 }}>
                No existe ground truth local para esta carrera — no se puede comparar.
              </div>
            )}
            {validacion.tipo === "error" && (
              <div style={{ color: "#f87171", fontSize: 13 }}>{validacion.msg}</div>
            )}
            {validacion.tipo === "ok" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC }}>
                    Resultado de validación
                  </span>
                  {validacion.score != null && (
                    <span style={{ fontWeight: 700, fontSize: 14, color: scoreColor(validacion.score) }}>
                      {validacion.score}/100
                    </span>
                  )}
                </div>
                <pre style={{
                  margin: 0, fontSize: 11, lineHeight: 1.7, color: TEXT,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  fontFamily: "var(--font-mono, monospace)",
                }}>
                  {validacion.output}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Buscador ── */}
        {json && (
          <div style={{ ...SURFACE, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC }}>
                Materias
              </span>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>
                {q ? `${filtradas.length} / ${materias.length}` : materias.length}
              </span>
              {seleccionado && (
                <button
                  onClick={() => setSeleccionado(null)}
                  style={{
                    marginLeft: "auto", background: "none", border: "none",
                    color: TEXT_SEC, fontSize: 11, cursor: "pointer", padding: 0,
                  }}
                >
                  ✕ limpiar selección
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Buscar por ID o nombre…"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setSeleccionado(null); }}
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "7px 12px",
                color: TEXT, fontSize: 12, outline: "none",
                marginBottom: 8,
              }}
            />
            {q && filtradas.length === 0 && (
              <div style={{ color: TEXT_SEC, fontSize: 12 }}>Sin resultados.</div>
            )}
            {filtradas.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
                {filtradas.map(m => {
                  const activa = seleccionado === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => seleccionar(m.id)}
                      style={{
                        display: "flex", alignItems: "baseline", gap: 8,
                        padding: "5px 8px", borderRadius: 6, border: "none",
                        background: activa ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.025)",
                        outline: activa ? "1px solid rgba(167,139,250,0.4)" : "none",
                        cursor: "pointer", textAlign: "left", width: "100%",
                        fontFamily: "var(--font-mono, monospace)",
                        transition: "background 0.1s",
                      }}
                    >
                      <span style={{ color: "#a78bfa", fontSize: 11, minWidth: 64, flexShrink: 0 }}>{m.id}</span>
                      <span style={{ color: TEXT, fontSize: 12 }}>{m.nombre}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── JSON completo ── */}
        {json && (
          <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
            <pre
              ref={jsonRef}
              style={{
                margin: 0, fontSize: 12, lineHeight: 1.65, color: TEXT,
                overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {seleccionado
                ? jsonSegments.map((seg, i) =>
                    seg.highlight ? (
                      <span
                        key={i}
                        ref={highlightRef}
                        style={{
                          background: "rgba(167,139,250,0.12)",
                          outline: "1px solid rgba(167,139,250,0.35)",
                          borderRadius: 4,
                          display: "inline",
                        }}
                      >
                        {seg.text}
                      </span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )
                : json}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
