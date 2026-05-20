"use client";

import { useMemo, useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT, STATUS_COLORS } from "@/lib/ui/tokens";
import { computeDiffs, type DiffItem, type ParseResult, type Materia, type CorValue } from "./DiffExportDrawer";
import GuardarPlanDrawer from "./GuardarPlanDrawer";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Lado = "parser" | "gemini" | "manual";

type Resolucion = {
  lado: Lado;
  // valor manual serializado (solo cuando lado === "manual")
  valorManual?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function serializeCor(val: CorValue): string {
  if (!val || typeof val !== "object") return String(val ?? "ninguna");
  const v = val as { para_cursar?: string | null; para_rendir?: string | null };
  return `cursar:${v.para_cursar ?? "—"} / rendir:${v.para_rendir ?? "—"}`;
}

function serializeCorMap(cors: Record<string, CorValue>): string {
  return (
    Object.entries(cors)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k} (${serializeCor(v)})`)
      .join("\n") || "ninguna"
  );
}

function parseCorsManual(raw: string): Record<string, CorValue> {
  // Formato esperado de la serialización: "M001 (cursar:M000 / rendir:—)\n..."
  // Se acepta también JSON puro si el usuario lo pega directamente
  try {
    return JSON.parse(raw) as Record<string, CorValue>;
  } catch {
    return {};
  }
}

function diffKey(d: DiffItem) {
  return `${d.tipo}:${d.id}`;
}

// Aplica las resoluciones sobre el plan base (parser) mezclando con Gemini donde se eligió
function buildMergedPlan(
  parser: ParseResult,
  gemini: ParseResult,
  diffs: DiffItem[],
  resoluciones: Map<string, Resolucion>,
): ParseResult {
  const geminiMap = new Map(gemini.materias.map((m) => [m.id, m]));
  const parserMap = new Map(parser.materias.map((m) => [m.id, m]));

  // Base: todas las materias del parser
  const mergedMaterias: Materia[] = parser.materias.map((m) => {
    const diffsForM = diffs.filter((d) => d.id === m.id);
    if (diffsForM.length === 0) return m;

    let resultado = { ...m };

    for (const diff of diffsForM) {
      const res = resoluciones.get(diffKey(diff));
      if (!res || res.lado === "parser") continue;

      const gemM = geminiMap.get(m.id);

      if (diff.tipo === "correlativa_distinta") {
        if (res.lado === "gemini" && gemM) {
          resultado = { ...resultado, correlativas: gemM.correlativas };
        } else if (res.lado === "manual") {
          resultado = { ...resultado, correlativas: parseCorsManual(res.valorManual ?? "{}") };
        }
      }

      if (diff.tipo === "requisito_distinto") {
        if (res.lado === "gemini" && gemM) {
          resultado = { ...resultado, requisito_especial: gemM.requisito_especial } as Materia;
        } else if (res.lado === "manual") {
          try {
            resultado = { ...resultado, requisito_especial: JSON.parse(res.valorManual ?? "null") } as Materia;
          } catch {}
        }
      }
    }

    return resultado;
  });

  // Materias extra de Gemini que fueron elegidas para incluir
  const extraDiffs = diffs.filter((d) => d.tipo === "materia_extra");
  for (const diff of extraDiffs) {
    const res = resoluciones.get(diffKey(diff));
    if (res?.lado === "gemini") {
      const gemM = geminiMap.get(diff.id);
      if (gemM && !parserMap.has(diff.id)) mergedMaterias.push(gemM);
    }
  }

  // Materias faltantes del parser que fueron elegidas para excluir (lado gemini = omitir)
  const faltantesDiffs = diffs.filter((d) => d.tipo === "materia_faltante");
  const excluir = new Set(
    faltantesDiffs
      .filter((d) => resoluciones.get(diffKey(d))?.lado === "gemini")
      .map((d) => d.id),
  );
  const finalMaterias = mergedMaterias.filter((m) => !excluir.has(m.id));

  // Agrupadores: merge simple (parser base, gemini si se elige)
  const agrupadorDiffs = diffs.filter(
    (d) => d.tipo === "agrupador_distinto" || d.tipo === "agrupador_faltante",
  );
  const mergedAgrupadores = [...parser.agrupadores];
  const geminiAgrMap = new Map(
    gemini.agrupadores.map((a) => [String((a as { id?: string }).id ?? ""), a]),
  );
  for (const diff of agrupadorDiffs) {
    const res = resoluciones.get(diffKey(diff));
    if (res?.lado !== "gemini") continue;
    const gemA = geminiAgrMap.get(diff.id);
    if (!gemA) continue;
    const idx = mergedAgrupadores.findIndex(
      (a) => String((a as { id?: string }).id ?? "") === diff.id,
    );
    if (idx >= 0) mergedAgrupadores[idx] = gemA;
    else mergedAgrupadores.push(gemA);
  }

  return {
    ...parser,
    materias: finalMaterias,
    agrupadores: mergedAgrupadores,
    _llm_prompt_version: `merge:parser+gemini`,
  };
}

// ── Badge config ───────────────────────────────────────────────────────────────

const BADGE_CFG: Record<
  DiffItem["tipo"],
  { label: string; color: string; bg: string; border: string }
> = {
  correlativa_distinta: { label: "correlativa distinta", color: "#f9c74f", bg: "rgba(249,199,79,0.12)", border: "rgba(249,199,79,0.35)" },
  materia_faltante:     { label: "falta en Gemini",      color: "#e76f51", bg: "rgba(231,111,81,0.12)",  border: "rgba(231,111,81,0.35)"  },
  materia_extra:        { label: "extra en Gemini",       color: "#90be6d", bg: "rgba(144,190,109,0.12)", border: "rgba(144,190,109,0.35)" },
  agrupador_distinto:   { label: "agrupador distinto",    color: "#4cc9f0", bg: "rgba(76,201,240,0.10)",  border: "rgba(76,201,240,0.35)"  },
  agrupador_faltante:   { label: "agrupador faltante",    color: "#e76f51", bg: "rgba(231,111,81,0.12)",  border: "rgba(231,111,81,0.35)"  },
  requisito_distinto:   { label: "requisito distinto",    color: "#c084fc", bg: "rgba(157,78,221,0.10)",  border: "rgba(157,78,221,0.35)"  },
};

// Etiquetas para el lado parser / gemini según el tipo de diff
function labelParser(d: DiffItem): string {
  if (d.tipo === "materia_faltante") return "Mantener la materia (parser)";
  if (d.tipo === "materia_extra") return "Excluir del merge (parser no la tiene)";
  return "Usar valor del parser";
}

function labelGemini(d: DiffItem): string {
  if (d.tipo === "materia_faltante") return "Eliminar la materia del merge";
  if (d.tipo === "materia_extra") return "Incluir la materia (Gemini la agregó)";
  return "Usar valor de Gemini";
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function MergeInteractivo({
  parser,
  gemini,
  onClose,
}: {
  parser: ParseResult;
  gemini: ParseResult;
  onClose: () => void;
}) {
  const diffs = useMemo(() => computeDiffs(parser, gemini), [parser, gemini]);

  // Resoluciones: diffKey → { lado, valorManual? }
  const [resoluciones, setResoluciones] = useState<Map<string, Resolucion>>(() => {
    // Por defecto: todo usa parser
    return new Map(diffs.map((d) => [diffKey(d), { lado: "parser" as Lado }]));
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [guardarAbierto, setGuardarAbierto] = useState(false);

  const totalResueltos = [...resoluciones.values()].filter((r) => r.lado !== undefined).length;
  const todoResuelto = totalResueltos === diffs.length;

  const mergedPlan = useMemo(
    () => buildMergedPlan(parser, gemini, diffs, resoluciones),
    [parser, gemini, diffs, resoluciones],
  );

  function setLado(key: string, lado: Lado) {
    setResoluciones((prev) => {
      const next = new Map(prev);
      next.set(key, { lado });
      return next;
    });
    if (lado !== "manual") setEditingKey(null);
  }

  function abrirEdicion(key: string, diff: DiffItem) {
    const res = resoluciones.get(key);
    const valorActual =
      res?.valorManual ??
      (diff.tipo === "correlativa_distinta"
        ? diff.groundTruth  // prefill con valor del parser
        : diff.groundTruth);
    setEditingValue(valorActual);
    setEditingKey(key);
    setLado(key, "manual");
  }

  function confirmarEdicion(key: string) {
    setResoluciones((prev) => {
      const next = new Map(prev);
      next.set(key, { lado: "manual", valorManual: editingValue });
      return next;
    });
    setEditingKey(null);
  }

  function resolverTodo(lado: Lado) {
    setResoluciones(new Map(diffs.map((d) => [diffKey(d), { lado }])));
  }

  if (diffs.length === 0) {
    return (
      <div style={{
        marginTop: 16, padding: "28px 20px", textAlign: "center",
        background: GLASS.dim, border: `1px solid ${GLASS.border}`, borderRadius: 12,
      }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 13, color: TEXT_SEC }}>No hay diferencias entre parser y Gemini. Los JSONs son idénticos.</div>
      </div>
    );
  }

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
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: TEXT }}>
            ⚡ Merge interactivo — {diffs.length} diferencia{diffs.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>
            Elegí qué versión usar para cada diferencia. El resultado es un JSON fusionado publicable.
          </div>
        </div>
        <button
          className="btn-press"
          onClick={onClose}
          style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Acciones globales */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>Resolver todo como:</span>
          <button className="btn-press" onClick={() => resolverTodo("parser")}
            style={{ ...BTN, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: "#90be6d", borderColor: "rgba(144,190,109,0.4)" }}>
            ✓ Parser (todos)
          </button>
          <button className="btn-press" onClick={() => resolverTodo("gemini")}
            style={{ ...BTN, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: "#f9c74f", borderColor: "rgba(249,199,79,0.4)" }}>
            ✓ Gemini (todos)
          </button>
          <span style={{ marginLeft: "auto", fontSize: 11, color: TEXT_SEC }}>
            {totalResueltos}/{diffs.length} resueltos
          </span>
        </div>

        {/* Lista de diffs */}
        {diffs.map((diff) => {
          const key = diffKey(diff);
          const badge = BADGE_CFG[diff.tipo];
          const res = resoluciones.get(key);
          const isEditing = editingKey === key;

          return (
            <div
              key={key}
              style={{
                border: `1px solid ${res ? GLASS.raised : GLASS.border}`,
                borderRadius: 10, padding: "12px 14px",
                background: SURFACE.background,
              }}
            >
              {/* Fila superior: ID + nombre + badge tipo */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: TEXT_SEC, flexShrink: 0 }}>{diff.id}</span>
                <span style={{ fontWeight: 600, fontSize: 12, color: TEXT, flex: 1, minWidth: 0 }}>{diff.nombre}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20, flexShrink: 0,
                  background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Valores side-by-side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <button
                  className="btn-press"
                  onClick={() => setLado(key, "parser")}
                  style={{
                    textAlign: "left", cursor: "pointer", borderRadius: 8, padding: "8px 10px",
                    background: res?.lado === "parser" ? "rgba(144,190,109,0.12)" : GLASS.soft,
                    border: `1.5px solid ${res?.lado === "parser" ? "#90be6d" : GLASS.border}`,
                    transition: "all 0.12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    {res?.lado === "parser" && <span style={{ fontSize: 10, color: "#90be6d" }}>✓</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#90be6d" }}>
                      Parser
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
                    {diff.groundTruth}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 4 }}>{labelParser(diff)}</div>
                </button>

                <button
                  className="btn-press"
                  onClick={() => setLado(key, "gemini")}
                  style={{
                    textAlign: "left", cursor: "pointer", borderRadius: 8, padding: "8px 10px",
                    background: res?.lado === "gemini" ? "rgba(249,199,79,0.10)" : GLASS.soft,
                    border: `1.5px solid ${res?.lado === "gemini" ? "#f9c74f" : GLASS.border}`,
                    transition: "all 0.12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    {res?.lado === "gemini" && <span style={{ fontSize: 10, color: "#f9c74f" }}>✓</span>}
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#f9c74f" }}>
                      Gemini
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
                    {diff.gemini}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 4 }}>{labelGemini(diff)}</div>
                </button>
              </div>

              {/* Botón editar manualmente */}
              {!isEditing && (
                <button
                  className="btn-press"
                  onClick={() => abrirEdicion(key, diff)}
                  style={{
                    ...BTN, borderRadius: 6, padding: "4px 12px", fontSize: 11,
                    borderColor: res?.lado === "manual" ? ACCENT : undefined,
                    color: res?.lado === "manual" ? ACCENT : undefined,
                  }}
                >
                  {res?.lado === "manual"
                    ? `✎ Manual: ${res.valorManual?.slice(0, 40)}${(res.valorManual?.length ?? 0) > 40 ? "…" : ""}`
                    : "✎ Editar manualmente"}
                </button>
              )}

              {/* Editor manual inline */}
              {isEditing && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: TEXT_SEC }}>
                    {diff.tipo === "correlativa_distinta" || diff.tipo === "requisito_distinto"
                      ? "Pegá el JSON del valor o editá el texto:"
                      : "Valor personalizado:"}
                  </div>
                  <textarea
                    autoFocus
                    rows={4}
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    style={{
                      ...INPUT, borderRadius: 7, padding: "8px 10px", fontSize: 11,
                      fontFamily: "'SF Mono','Fira Code',monospace", resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-press"
                      onClick={() => confirmarEdicion(key)}
                      style={{ ...BTN_VIOLET, borderRadius: 6, padding: "5px 14px", fontSize: 11, fontWeight: 600 }}
                    >
                      Confirmar
                    </button>
                    <button className="btn-press"
                      onClick={() => { setEditingKey(null); setLado(key, "parser"); }}
                      style={{ ...BTN, borderRadius: 6, padding: "5px 10px", fontSize: 11 }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Resumen del JSON resultante */}
        <div style={{ ...SURFACE, borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC, marginBottom: 8 }}>
            JSON fusionado resultante
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              { label: "Materias", value: mergedPlan.materias.length },
              { label: "Agrupadores", value: mergedPlan.agrupadores.length },
              {
                label: "Usando parser",
                value: [...resoluciones.values()].filter((r) => r.lado === "parser").length,
              },
              {
                label: "Usando Gemini",
                value: [...resoluciones.values()].filter((r) => r.lado === "gemini").length,
              },
              {
                label: "Manual",
                value: [...resoluciones.values()].filter((r) => r.lado === "manual").length,
              },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 10, color: TEXT_SEC, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Acción de publicar */}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button
            className="btn-press"
            onClick={() => setGuardarAbierto(true)}
            disabled={!todoResuelto}
            style={{
              background: todoResuelto ? STATUS_COLORS.aprobada.badgeBg : GLASS.elevated,
              border: `1px solid ${todoResuelto ? STATUS_COLORS.aprobada.badgeBorder : GLASS.border}`,
              color: todoResuelto ? STATUS_COLORS.aprobada.accent : TEXT_SEC,
              borderRadius: 8, padding: "9px 20px",
              fontSize: 13, fontWeight: 700,
              cursor: todoResuelto ? "pointer" : "not-allowed",
              opacity: todoResuelto ? 1 : 0.5,
            }}
          >
            ✓ Usar JSON fusionado
          </button>
          <button className="btn-press" onClick={onClose} style={{ ...BTN, borderRadius: 8, padding: "9px 16px", fontSize: 13 }}>
            Cancelar
          </button>
        </div>
      </div>

      {/* GuardarPlanDrawer reutilizado */}
      {guardarAbierto && (
        <GuardarPlanDrawer
          data={mergedPlan}
          fuente="gemini"
          onClose={() => setGuardarAbierto(false)}
        />
      )}
    </div>
  );
}
