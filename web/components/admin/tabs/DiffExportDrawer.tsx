"use client";

import { useState, useMemo } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT } from "@/lib/ui/tokens";

export type CorValue = { para_cursar?: string | null; para_rendir?: string | null } | string | null | unknown;

export type Materia = {
  id: string;
  nombre: string;
  año: string | null;
  correlativas: Record<string, CorValue>;
  horas: string;
  categoria: string;
  cuatrimestre?: string | null;
  [key: string]: unknown;
};

export type Agrupador = {
  id?: string;
  nombre?: string;
  [key: string]: unknown;
};

export type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Materia[];
  agrupadores: Agrupador[];
  _llm_confidence?: number;
  _llm_prompt_version?: string;
  [key: string]: unknown;
};

export type DiffItem = {
  id: string;
  nombre: string;
  tipo: "correlativa_distinta" | "materia_faltante" | "materia_extra" | "agrupador_distinto" | "agrupador_faltante";
  groundTruth: string;
  gemini: string;
};

function serializeCor(val: CorValue): string {
  if (!val || typeof val !== "object") return String(val ?? "");
  const v = val as { para_cursar?: string | null; para_rendir?: string | null };
  return `cursar:${v.para_cursar ?? "—"}/rendir:${v.para_rendir ?? "—"}`;
}

function serializeCorMap(cors: Record<string, CorValue>): string {
  return Object.entries(cors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}(${serializeCor(v)})`)
    .join(", ") || "ninguna";
}

export function computeDiffs(ground: ParseResult | null, gemini: ParseResult): DiffItem[] {
  const diffs: DiffItem[] = [];
  if (!ground) return diffs;

  const groundMap = new Map(ground.materias.map(m => [m.id, m]));
  const geminiMap = new Map(gemini.materias.map(m => [m.id, m]));

  for (const [id, gm] of groundMap) {
    const gem = geminiMap.get(id);
    if (!gem) {
      diffs.push({
        id, nombre: gm.nombre, tipo: "materia_faltante",
        groundTruth: `${gm.nombre} (${gm.horas}h)`,
        gemini: "(no incluida)",
      });
    } else {
      const gtCors = serializeCorMap(gm.correlativas);
      const gemCors = serializeCorMap(gem.correlativas);
      if (gtCors !== gemCors) {
        diffs.push({
          id, nombre: gm.nombre, tipo: "correlativa_distinta",
          groundTruth: gtCors,
          gemini: gemCors,
        });
      }
    }
  }

  for (const [id, gem] of geminiMap) {
    if (!groundMap.has(id)) {
      diffs.push({
        id, nombre: gem.nombre, tipo: "materia_extra",
        groundTruth: "(no estaba en el parser)",
        gemini: `${gem.nombre} (${gem.horas}h)`,
      });
    }
  }

  // Comparar nombres de agrupadores
  const groundAgr = new Map(ground.agrupadores.map(a => [a.id ?? "", a.nombre ?? ""]));
  const geminiAgr = new Map(gemini.agrupadores.map(a => [a.id ?? "", a.nombre ?? ""]));
  for (const [id, nombre] of groundAgr) {
    if (!id) continue;
    const gemNombre = geminiAgr.get(id);
    if (gemNombre === undefined) {
      diffs.push({ id, nombre, tipo: "agrupador_faltante", groundTruth: nombre, gemini: "(ausente en Gemini)" });
    } else if (gemNombre !== nombre) {
      diffs.push({ id, nombre, tipo: "agrupador_distinto", groundTruth: nombre, gemini: gemNombre });
    }
  }

  return diffs;
}

const BADGE: Record<DiffItem["tipo"], { label: string; bg: string; border: string; color: string }> = {
  correlativa_distinta: { label: "correlativa distinta", bg: "rgba(249,199,79,0.15)", border: "rgba(249,199,79,0.4)", color: "#f9c74f" },
  materia_faltante:     { label: "materia faltante",     bg: "rgba(231,111,81,0.15)", border: "rgba(231,111,81,0.4)", color: "#e76f51" },
  materia_extra:        { label: "materia extra",        bg: "rgba(144,190,109,0.15)", border: "rgba(144,190,109,0.4)", color: "#90be6d" },
  agrupador_distinto:   { label: "agrupador distinto",   bg: "rgba(76,201,240,0.12)",  border: "rgba(76,201,240,0.4)",  color: "#4cc9f0" },
  agrupador_faltante:   { label: "agrupador faltante",   bg: "rgba(231,111,81,0.15)",  border: "rgba(231,111,81,0.4)",  color: "#e76f51" },
};

function diffKey(d: DiffItem) { return `${d.tipo}:${d.id}`; }

function buildFewShotBlock(
  gemini: ParseResult,
  ground: ParseResult | null,
  selected: Set<string>,
  diffs: DiffItem[],
  notes: Record<string, string>,
): string {
  const selectedDiffs = diffs.filter(d => selected.has(diffKey(d)));
  if (selectedDiffs.length === 0) return "// Seleccioná al menos una diferencia";

  const lines: string[] = [
    `## Few-shot example — ${gemini.plan.carrera} (${gemini.plan.codigo_plan})`,
    `### Input context`,
    `Plan: ${gemini.plan.universidad} · ${gemini.plan.carrera} · ${gemini.plan.codigo_plan}`,
    ``,
    `### Corrections`,
  ];

  for (const diff of selectedDiffs) {
    const badge = BADGE[diff.tipo];
    lines.push(`- [${badge.label.toUpperCase()}] Materia ${diff.id} — ${diff.nombre}`);
    if (diff.tipo === "correlativa_distinta") {
      lines.push(`  Ground truth correlativas: ${diff.groundTruth}`);
      lines.push(`  Gemini generated:          ${diff.gemini}`);
    } else if (diff.tipo === "materia_faltante") {
      lines.push(`  This materia was missing from Gemini output.`);
      lines.push(`  Expected: ${diff.groundTruth}`);
    } else {
      lines.push(`  This materia was added by Gemini but not in the ground truth.`);
    }
    const dk = diffKey(diff);
    if (notes[dk]) lines.push(`  Instruction: ${notes[dk]}`);
    lines.push("");
  }

  if (ground) {
    lines.push(`### Expected output fragment`);
    lines.push("```json");
    const fragment = ground.materias
      .filter(m => selected.has(m.id))
      .map(m => ({ id: m.id, nombre: m.nombre, correlativas: m.correlativas }));
    lines.push(JSON.stringify(fragment, null, 2));
    lines.push("```");
  }

  return lines.join("\n");
}

export default function DiffExportDrawer({
  gemini,
  ground,
  onClose,
}: {
  gemini: ParseResult;
  ground: ParseResult | null;
  onClose: () => void;
}) {
  const diffs = useMemo(() => computeDiffs(ground, gemini), [ground, gemini]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(diffs.map(diffKey)));
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const fewShot = useMemo(() => buildFewShotBlock(gemini, ground, selected, diffs, notes), [gemini, ground, selected, diffs, notes]);

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(diffs.map(diffKey)) : new Set());
  }

  function toggle(d: DiffItem) {
    const k = diffKey(d);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) { next.delete(k); } else { next.add(k); }
      return next;
    });
  }

  function copy() {
    navigator.clipboard.writeText(fewShot);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([fewShot], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fewshot_${gemini.plan.codigo_plan.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            Dataset few-shot — {diffs.length} diferencia{diffs.length !== 1 ? "s" : ""} encontrada{diffs.length !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>
            Exportá correcciones para mejorar el prompt de Gemini con ejemplos concretos
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}>×</button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {diffs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_SEC, fontSize: 13 }}>
            No hay ground truth cargado o no se encontraron diferencias.
          </div>
        ) : (
          <>
            {/* Select all */}
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: TEXT_SEC, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selected.size === diffs.length}
                onChange={e => toggleAll(e.target.checked)}
                style={{ accentColor: ACCENT, width: 13, height: 13 }}
              />
              Seleccionar todas ({diffs.length})
            </label>

            {/* Diff cards */}
            {diffs.map((diff, idx) => {
              const badge = BADGE[diff.tipo];
              const isSelected = selected.has(diffKey(diff));
              return (
                <div key={`${diffKey(diff)}:${idx}`} style={{
                  border: `1px solid ${isSelected ? GLASS.raised : GLASS.border}`,
                  borderRadius: 10, padding: "12px 14px",
                  background: isSelected ? GLASS.soft : GLASS.faint,
                  transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(diff)}
                      style={{ accentColor: ACCENT, width: 14, height: 14, flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 600, fontSize: 12, color: TEXT, flex: 1 }}>
                      {diff.id} — {diff.nombre}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                      background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{
                      background: "rgba(144,190,109,0.08)", border: "1px solid rgba(144,190,109,0.2)",
                      borderRadius: 7, padding: "8px 10px",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#90be6d", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        PDF / Parser (ground truth)
                      </div>
                      <div style={{ fontSize: 11, color: TEXT, wordBreak: "break-word" }}>{diff.groundTruth}</div>
                    </div>
                    <div style={{
                      background: "rgba(249,199,79,0.06)", border: `1px solid ${diff.tipo === "correlativa_distinta" ? "rgba(249,199,79,0.2)" : GLASS.border}`,
                      borderRadius: 7, padding: "8px 10px",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: diff.tipo === "correlativa_distinta" ? "#f9c74f" : TEXT_SEC, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Gemini generó
                      </div>
                      <div style={{ fontSize: 11, color: TEXT, wordBreak: "break-word" }}>{diff.gemini}</div>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Corrección para el prompt (opcional)…"
                    value={notes[diffKey(diff)] ?? ""}
                    onChange={e => setNotes(prev => ({ ...prev, [diffKey(diff)]: e.target.value }))}
                    style={{ ...INPUT, borderRadius: 7, padding: "6px 10px", fontSize: 11 }}
                  />
                </div>
              );
            })}

            {/* Preview */}
            <div style={{ ...SURFACE, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", background: GLASS.elevated, borderBottom: `1px solid ${GLASS.border}`, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: TEXT_SEC }}>
                Preview del bloque few-shot
              </div>
              <pre style={{
                padding: "12px 14px", fontSize: 10, lineHeight: 1.7, color: TEXT_SEC,
                whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto",
                margin: 0, fontFamily: "'SF Mono','Fira Code',monospace",
              }}>
                {fewShot}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={copy}
                style={{ ...BTN_VIOLET, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}
              >
                {copied ? "✓ Copiado" : "📋 Copiar para el prompt"}
              </button>
              <button
                onClick={download}
                style={{ ...BTN, borderRadius: 8, padding: "8px 14px", fontSize: 12 }}
              >
                ⬇ Descargar .txt
              </button>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: TEXT_SEC, cursor: "not-allowed", opacity: 0.5 }}>
                <input type="checkbox" disabled style={{ accentColor: ACCENT, width: 13, height: 13 }} />
                Agregar automáticamente al prompt del sistema
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
