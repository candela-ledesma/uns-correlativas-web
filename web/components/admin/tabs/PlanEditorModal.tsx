"use client";

import { useState, useCallback } from "react";
import {
  GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT,
} from "@/lib/ui/tokens";

// ── Types ─────────────────────────────────────────────────────────────────────

type Correlativa = {
  id: string;
  tipo: string; // "cursada_aprobada" | "final_aprobado" | etc.
};

type Materia = {
  id: string;
  nombre: string;
  anio?: number | null;
  cuatrimestre?: number | null;
  para_cursar?: Correlativa[];
  para_rendir?: Correlativa[];
  [key: string]: unknown;
};

type PlanMetadata = {
  carrera: string;
  universidad: string;
  codigo_plan: string;
};

type PlanJson = {
  plan: PlanMetadata;
  materias: Materia[];
  agrupadores?: unknown[];
  [key: string]: unknown;
};

type Props = {
  slug: string;
  nombre: string;
  departamento: string;
  jsonStr: string;
  saving: boolean;
  onGuardar: (newJson: string, newNombre: string, newDepartamento: string) => void;
  onCancelar: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePlan(jsonStr: string): PlanJson | null {
  try {
    return JSON.parse(jsonStr) as PlanJson;
  } catch {
    return null;
  }
}

function serializePlan(plan: PlanJson): string {
  return JSON.stringify(plan, null, 2);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...INPUT, borderRadius: 7, padding: "6px 10px",
        fontSize: 12,
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
      }}
    />
  );
}

// ── Correlativas row editor ───────────────────────────────────────────────────

function CorrelativasEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: Correlativa[];
  onChange: (next: Correlativa[]) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: TEXT_SEC, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input
              value={c.id}
              onChange={e => {
                const next = [...items];
                next[i] = { ...c, id: e.target.value };
                onChange(next);
              }}
              placeholder="ID"
              style={{
                ...INPUT, borderRadius: 5, padding: "3px 7px",
                fontSize: 11, fontFamily: "var(--font-mono, monospace)", width: 80,
              }}
            />
            <select
              value={c.tipo}
              onChange={e => {
                const next = [...items];
                next[i] = { ...c, tipo: e.target.value };
                onChange(next);
              }}
              style={{
                ...INPUT, borderRadius: 5, padding: "3px 7px",
                fontSize: 11, width: "auto", cursor: "pointer",
              }}
            >
              <option value="cursada_aprobada">cursada_aprobada</option>
              <option value="final_aprobado">final_aprobado</option>
              <option value="cgcb_aprobado">cgcb_aprobado</option>
            </select>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#f87171", fontSize: 14, lineHeight: 1, padding: "0 2px",
                flexShrink: 0,
              }}
              title="Quitar"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, { id: "", tipo: "cursada_aprobada" }])}
          style={{
            background: "none", border: `1px dashed ${GLASS.border}`, borderRadius: 5,
            color: TEXT_SEC, fontSize: 10, padding: "3px 8px", cursor: "pointer",
            width: "fit-content", marginTop: 2,
          }}
        >
          + agregar
        </button>
      </div>
    </div>
  );
}

// ── Materia row ───────────────────────────────────────────────────────────────

function MateriaRow({
  materia,
  onChange,
  onDelete,
  expanded,
  onToggle,
}: {
  materia: Materia;
  onChange: (m: Materia) => void;
  onDelete: () => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${GLASS.border}`,
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {/* Cabecera siempre visible */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px",
          background: GLASS.dim,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <span style={{ color: TEXT_SEC, fontSize: 10, minWidth: 12 }}>{expanded ? "▾" : "▸"}</span>
        <code style={{ fontSize: 11, color: "#a78bfa", minWidth: 72, flexShrink: 0 }}>{materia.id || "—"}</code>
        <span style={{ fontSize: 12, color: TEXT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {materia.nombre || <em style={{ color: TEXT_SEC }}>sin nombre</em>}
        </span>
        <span style={{ fontSize: 10, color: TEXT_SEC, flexShrink: 0 }}>
          {materia.anio != null ? `${materia.anio}°` : "—"}{materia.cuatrimestre != null ? ` C${materia.cuatrimestre}` : ""}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#f87171", fontSize: 14, lineHeight: 1, padding: "0 2px", flexShrink: 0,
          }}
          title="Eliminar materia"
        >
          ×
        </button>
      </div>

      {/* Expansión de detalles */}
      {expanded && (
        <div style={{
          padding: "12px 14px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          background: GLASS.faint,
          borderTop: `1px solid ${GLASS.border}`,
        }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8 }}>
            <div>
              <FieldLabel>Nombre</FieldLabel>
              <TextInput value={materia.nombre} onChange={v => onChange({ ...materia, nombre: v })} placeholder="Nombre de la materia" />
            </div>
            <div>
              <FieldLabel>Año</FieldLabel>
              <input
                type="number" min={1} max={6}
                value={materia.anio ?? ""}
                onChange={e => onChange({ ...materia, anio: e.target.value ? Number(e.target.value) : null })}
                style={{ ...INPUT, borderRadius: 7, padding: "6px 8px", fontSize: 12, width: "100%" }}
              />
            </div>
            <div>
              <FieldLabel>Cuatrimestre</FieldLabel>
              <input
                type="number" min={1} max={2}
                value={materia.cuatrimestre ?? ""}
                onChange={e => onChange({ ...materia, cuatrimestre: e.target.value ? Number(e.target.value) : null })}
                style={{ ...INPUT, borderRadius: 7, padding: "6px 8px", fontSize: 12, width: "100%" }}
              />
            </div>
          </div>

          <div>
            <FieldLabel>ID</FieldLabel>
            <TextInput
              value={materia.id}
              onChange={v => onChange({ ...materia, id: v })}
              placeholder="ej. MAT1"
              mono
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <CorrelativasEditor
              label="Para cursar"
              items={materia.para_cursar ?? []}
              onChange={v => onChange({ ...materia, para_cursar: v })}
            />
            <CorrelativasEditor
              label="Para rendir"
              items={materia.para_rendir ?? []}
              onChange={v => onChange({ ...materia, para_rendir: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanEditorModal({
  slug,
  nombre: initialNombre,
  departamento: initialDepartamento,
  jsonStr,
  saving,
  onGuardar,
  onCancelar,
}: Props) {
  const [mode, setMode] = useState<"form" | "json">("form");

  // Form state
  const initialPlan = parsePlan(jsonStr);
  const [metadata, setMetadata] = useState<PlanMetadata>(
    initialPlan?.plan ?? { carrera: "", universidad: "", codigo_plan: "" }
  );
  const [materias, setMaterias] = useState<Materia[]>(initialPlan?.materias ?? []);
  const [nombre, setNombre] = useState(initialNombre);
  const [departamento, setDepartamento] = useState(initialDepartamento);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // JSON mode state — initialized from form on toggle
  const [jsonText, setJsonText] = useState(jsonStr);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Build current JSON from form state
  const buildJson = useCallback((): string => {
    if (!initialPlan) return jsonStr;
    return serializePlan({ ...initialPlan, plan: metadata, materias });
  }, [initialPlan, jsonStr, metadata, materias]);

  // Toggle to JSON: sync form → JSON
  function goToJson() {
    setJsonText(buildJson());
    setJsonError(null);
    setMode("json");
  }

  // Toggle to form: parse JSON → form
  function goToForm() {
    const parsed = parsePlan(jsonText);
    if (!parsed) {
      setJsonError("JSON inválido — corregí la sintaxis antes de cambiar a formulario.");
      return;
    }
    setMetadata(parsed.plan ?? { carrera: "", universidad: "", codigo_plan: "" });
    setMaterias(parsed.materias ?? []);
    setJsonError(null);
    setMode("form");
  }

  function handleGuardar() {
    if (mode === "form") {
      onGuardar(buildJson(), nombre, departamento);
    } else {
      try {
        JSON.parse(jsonText);
      } catch {
        setJsonError("JSON inválido — revisá la sintaxis antes de guardar.");
        return;
      }
      onGuardar(jsonText, nombre, departamento);
    }
  }

  const q = busqueda.trim().toLowerCase();
  const materiasFiltradas = q
    ? materias.filter(m => m.id.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q))
    : materias;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn-press"
          onClick={onCancelar}
          style={{ ...BTN, borderRadius: 8, padding: "4px 14px", fontSize: 12 }}
        >
          ← Volver
        </button>
        <span style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{initialNombre}</span>
        <span style={{ fontSize: 11, color: TEXT_SEC }}>— editando</span>

        {/* Mode toggle */}
        <div style={{
          display: "flex", gap: 0,
          background: GLASS.dim, border: `1px solid ${GLASS.border}`, borderRadius: 7,
          overflow: "hidden", marginLeft: "auto",
        }}>
          {(["form", "json"] as const).map(m => (
            <button
              key={m}
              onClick={m === "form" ? goToForm : goToJson}
              style={{
                padding: "4px 14px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                background: mode === m ? "rgba(157,78,221,0.7)" : "transparent",
                color: mode === m ? "#fff" : TEXT_SEC,
                transition: "background 0.15s",
              }}
            >
              {m === "form" ? "Formulario" : "JSON"}
            </button>
          ))}
        </div>

        <button className="btn-press"
          onClick={handleGuardar}
          disabled={saving}
          style={{
            ...BTN_VIOLET, borderRadius: 8, padding: "4px 16px", fontSize: 12, fontWeight: 600,
            opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {jsonError && (
        <div style={{
          color: "#f87171", fontSize: 12, padding: "6px 10px",
          background: "rgba(248,113,113,0.1)", borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)",
        }}>
          {jsonError}
        </div>
      )}

      {/* ── Form mode ── */}
      {mode === "form" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Metadata panel */}
          <div style={{ ...SURFACE, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC }}>
              Metadata del plan
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <FieldLabel>Nombre (CarreraConfig)</FieldLabel>
                <TextInput value={nombre} onChange={setNombre} placeholder="Nombre visible" />
              </div>
              <div>
                <FieldLabel>Departamento (CarreraConfig)</FieldLabel>
                <TextInput value={departamento} onChange={setDepartamento} placeholder="Departamento" />
              </div>
              <div>
                <FieldLabel>Carrera (JSON › plan.carrera)</FieldLabel>
                <TextInput
                  value={metadata.carrera}
                  onChange={v => setMetadata(m => ({ ...m, carrera: v }))}
                  placeholder="Nombre de la carrera"
                />
              </div>
              <div>
                <FieldLabel>Universidad (JSON › plan.universidad)</FieldLabel>
                <TextInput
                  value={metadata.universidad}
                  onChange={v => setMetadata(m => ({ ...m, universidad: v }))}
                  placeholder="Universidad"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Código plan (JSON › plan.codigo_plan)</FieldLabel>
                <TextInput
                  value={metadata.codigo_plan}
                  onChange={v => setMetadata(m => ({ ...m, codigo_plan: v }))}
                  placeholder="ej. Plan 2025 - Versión 1"
                  mono
                />
              </div>
            </div>
          </div>

          {/* Materias panel */}
          <div style={{ ...SURFACE, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC }}>
                Materias
              </span>
              <span style={{ fontSize: 11, color: TEXT_SEC }}>
                {q ? `${materiasFiltradas.length} / ${materias.length}` : materias.length}
              </span>
              <button
                onClick={() => {
                  const nueva: Materia = { id: "", nombre: "", anio: null, cuatrimestre: null, para_cursar: [], para_rendir: [] };
                  setMaterias(prev => [nueva, ...prev]);
                  setExpandedId("");
                }}
                style={{
                  marginLeft: "auto",
                  background: "rgba(157,78,221,0.15)", border: "1px solid rgba(157,78,221,0.35)",
                  color: "#c4b5fd", borderRadius: 6, padding: "3px 12px", fontSize: 11,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                + Nueva materia
              </button>
            </div>

            <input
              type="text"
              placeholder="Buscar por ID o nombre…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                ...INPUT, borderRadius: 7, padding: "6px 10px",
                fontSize: 12, marginBottom: 8,
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 520, overflowY: "auto" }}>
              {materiasFiltradas.length === 0 && q && (
                <div style={{ color: TEXT_SEC, fontSize: 12, padding: "8px 0" }}>Sin resultados.</div>
              )}
              {materiasFiltradas.map((m) => {
                const idx = materias.indexOf(m);
                return (
                  <MateriaRow
                    key={m.id + idx}
                    materia={m}
                    expanded={expandedId === (m.id || String(idx))}
                    onToggle={() => setExpandedId(prev => prev === (m.id || String(idx)) ? null : (m.id || String(idx)))}
                    onChange={updated => {
                      setMaterias(prev => {
                        const next = [...prev];
                        next[idx] = updated;
                        return next;
                      });
                      if (updated.id !== m.id) setExpandedId(updated.id);
                    }}
                    onDelete={() => {
                      setMaterias(prev => prev.filter((_, i) => i !== idx));
                      if (expandedId === (m.id || String(idx))) setExpandedId(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── JSON mode ── */}
      {mode === "json" && (
        <textarea
          value={jsonText}
          onChange={ev => { setJsonError(null); setJsonText(ev.target.value); }}
          spellCheck={false}
          style={{
            ...INPUT,
            borderRadius: 10, padding: "14px 16px",
            fontSize: 12, lineHeight: 1.65,
            fontFamily: "var(--font-mono, monospace)",
            minHeight: 600, resize: "vertical",
            whiteSpace: "pre",
          }}
        />
      )}

      {/* slug badge */}
      <div style={{ fontSize: 10, color: TEXT_SEC, opacity: 0.6 }}>slug: {slug}</div>
    </div>
  );
}
