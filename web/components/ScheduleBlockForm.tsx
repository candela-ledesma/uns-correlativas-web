"use client";

import { FormEvent, useRef, useState } from "react";
import {
  DIAS_SEMANA,
  minutesToTimeString,
  timeStringToMinutes,
  HORA_INICIO_GRILLA,
  HORA_FIN_GRILLA,
  SLOT_MINUTOS,
} from "@/lib/scheduleValidation";
import type { ScheduleBlock, CreateBlockInput, UpdateBlockInput } from "@/hooks/useSchedule";

import { TEXT_SEC, INPUT as INPUT_BASE, BTN as BTN_BASE, BTN_VIOLET, ERROR_PANEL } from "@/lib/tokens";
const INPUT   = { ...INPUT_BASE,  borderRadius: 10, padding: "8px 12px",  fontSize: 14 } as const;
const BTN     = { ...BTN_BASE,    borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600 } as const;
const BTN_VIO = { ...BTN_VIOLET,  borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 700 } as const;
const LABEL   = { display: "block", color: TEXT_SEC, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 } as const;
const HINT    = { color: TEXT_SEC, fontSize: 11, opacity: 0.7, marginTop: 4, display: "block" } as const;

// ── Time options ───────────────────────────────────────────────────────────
const OPCIONES_HORA: string[] = [];
for (let m = HORA_INICIO_GRILLA; m <= HORA_FIN_GRILLA; m += SLOT_MINUTOS) {
  OPCIONES_HORA.push(minutesToTimeString(m));
}

// ── Colors ─────────────────────────────────────────────────────────────────
const BLOCK_COLORS = [
  { value: "#9d4edd", label: "Violeta" },
  { value: "#2563eb", label: "Azul"    },
  { value: "#16a34a", label: "Verde"   },
  { value: "#ea580c", label: "Naranja" },
  { value: "#dc2626", label: "Rojo"    },
  { value: "#0891b2", label: "Cian"    },
];

// ── Types ──────────────────────────────────────────────────────────────────
type Props = {
  block?: ScheduleBlock;
  defaultDia?: number;
  defaultHoraInicio?: number;
  materias: { id: string; nombre: string }[];
  onSave: (data: CreateBlockInput | UpdateBlockInput) => Promise<{ error?: string }>;
  onCancel: () => void;
};

export default function ScheduleBlockForm({ block, defaultDia, defaultHoraInicio, materias, onSave, onCancel }: Props) {
  const [materiaNombre, setMateriaNombre] = useState(block?.materiaNombre ?? "");
  const [materiaId,     setMateriaId]     = useState(block?.materiaId ?? "");
  const [dia,           setDia]           = useState(block?.dia ?? defaultDia ?? 1);
  const [horaInicio,    setHoraInicio]    = useState(minutesToTimeString(block?.horaInicio ?? defaultHoraInicio ?? HORA_INICIO_GRILLA));
  const [horaFin,       setHoraFin]       = useState(minutesToTimeString(block?.horaFin ?? (defaultHoraInicio ?? HORA_INICIO_GRILLA) + 90));
  const [comision,      setComision]      = useState(block?.comision ?? "");
  const [notas,         setNotas]         = useState(block?.notas ?? "");
  const [color,         setColor]         = useState(block?.color ?? BLOCK_COLORS[0].value);
  const [error,         setError]         = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);

  const nombreRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const ini = timeStringToMinutes(horaInicio);
    const fin = timeStringToMinutes(horaFin);

    if (fin <= ini) {
      setError('"Hasta" debe ser posterior a "Desde"');
      return;
    }

    setSaving(true);
    const result = await onSave({
      materiaNombre: materiaNombre.trim(),
      materiaId: materiaId || null,
      dia, horaInicio: ini, horaFin: fin,
      comision: comision.trim() || null,
      notas: notas.trim() || null,
      color,
    });
    setSaving(false);
    if (result.error) setError(result.error);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 14 }}>

      {/* Error */}
      {error && (
        <div role="alert" style={{ ...ERROR_PANEL, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Materia */}
      <div>
        <label style={LABEL}>Materia</label>
        {materias.length > 0 && (
          <select value={materiaId} onChange={(e) => { setMateriaId(e.target.value); const f = materias.find((m) => m.id === e.target.value); setMateriaNombre(f ? f.nombre : ""); }} style={INPUT}>
            <option value="">— escribir nombre manualmente —</option>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        )}
        {(!materiaId || materias.length === 0) && (
          <input
            ref={nombreRef}
            type="text"
            value={materiaNombre}
            onChange={(e) => setMateriaNombre(e.target.value)}
            style={{ ...INPUT, marginTop: materias.length > 0 ? 8 : 0 }}
            placeholder="Nombre de la materia"
            autoFocus={!block}
            required
            maxLength={200}
          />
        )}
      </div>

      {/* Día + Desde + Hasta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div style={{ minWidth: 0 }}>
          <label style={LABEL}>Día</label>
          <select value={dia} onChange={(e) => setDia(Number(e.target.value))} style={INPUT}>
            {DIAS_SEMANA.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={LABEL}>Desde</label>
          <select value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} style={INPUT} required>
            {OPCIONES_HORA.filter((h) => h < "22:00").map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <span style={HINT}>Formato 24 hs</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={LABEL}>Hasta</label>
          <select value={horaFin} onChange={(e) => setHoraFin(e.target.value)} style={INPUT} required>
            {OPCIONES_HORA.filter((h) => h > "08:00").map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <span style={HINT}>Formato 24 hs</span>
        </div>
      </div>

      {/* Comisión + Color */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "end" }}>
        <div style={{ minWidth: 0 }}>
          <label style={LABEL}>Comisión (opcional)</label>
          <input type="text" value={comision} onChange={(e) => setComision(e.target.value)} style={INPUT} placeholder="Ej: A1, Turno tarde" maxLength={100} />
        </div>
        <div>
          <label style={LABEL}>Color</label>
          <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
            {BLOCK_COLORS.map((c) => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => setColor(c.value)}
                style={{ width: 26, height: 26, borderRadius: "50%", background: c.value, cursor: "pointer", border: color === c.value ? "2.5px solid #fff" : "2.5px solid transparent", boxShadow: color === c.value ? `0 0 0 1.5px ${c.value}` : "none", transition: "box-shadow 0.15s, border-color 0.15s" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label style={LABEL}>Notas (opcional)</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
          style={{ ...INPUT, resize: "none", lineHeight: 1.5 } as React.CSSProperties}
          rows={2} maxLength={500}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
        <button type="submit" disabled={saving}
          style={{ ...BTN_VIO, flex: 1, opacity: saving ? 0.65 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Guardando..." : block ? "Guardar cambios" : "Agregar bloque"}
        </button>
        <button type="button" onClick={onCancel} style={BTN}>Cancelar</button>
      </div>

    </form>
  );
}
