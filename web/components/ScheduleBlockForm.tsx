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

const OPCIONES_HORA: string[] = [];
for (let m = HORA_INICIO_GRILLA; m <= HORA_FIN_GRILLA; m += SLOT_MINUTOS) {
  OPCIONES_HORA.push(minutesToTimeString(m));
}
import type { ScheduleBlock, CreateBlockInput, UpdateBlockInput } from "@/hooks/useSchedule";

const BLOCK_COLORS = [
  { value: "#9d4edd", label: "Violeta" },
  { value: "#2563eb", label: "Azul" },
  { value: "#16a34a", label: "Verde" },
  { value: "#ea580c", label: "Naranja" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#0891b2", label: "Cian" },
];

type Props = {
  block?: ScheduleBlock;
  defaultDia?: number;
  defaultHoraInicio?: number;
  materias: { id: string; nombre: string }[];
  onSave: (data: CreateBlockInput | UpdateBlockInput) => Promise<{ error?: string }>;
  onCancel: () => void;
};

const inputCls =
  "w-full min-w-0 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1";

export default function ScheduleBlockForm({
  block,
  defaultDia,
  defaultHoraInicio,
  materias,
  onSave,
  onCancel,
}: Props) {
  const [materiaNombre, setMateriaNombre] = useState(block?.materiaNombre ?? "");
  const [materiaId, setMateriaId] = useState(block?.materiaId ?? "");
  const [dia, setDia] = useState(block?.dia ?? defaultDia ?? 1);
  const [horaInicio, setHoraInicio] = useState(
    minutesToTimeString(block?.horaInicio ?? defaultHoraInicio ?? HORA_INICIO_GRILLA),
  );
  const [horaFin, setHoraFin] = useState(
    minutesToTimeString(block?.horaFin ?? (defaultHoraInicio ?? HORA_INICIO_GRILLA) + 90),
  );
  const [comision, setComision] = useState(block?.comision ?? "");
  const [notas, setNotas] = useState(block?.notas ?? "");
  const [color, setColor] = useState(block?.color ?? BLOCK_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nombreRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const horaInicioMin = timeStringToMinutes(horaInicio);
    const horaFinMin = timeStringToMinutes(horaFin);

    if (horaFinMin <= horaInicioMin) {
      setError("\"Hasta\" debe ser posterior a \"Desde\"");
      return;
    }

    setSaving(true);
    const result = await onSave({
      materiaNombre: materiaNombre.trim(),
      materiaId: materiaId || null,
      dia,
      horaInicio: horaInicioMin,
      horaFin: horaFinMin,
      comision: comision.trim() || null,
      notas: notas.trim() || null,
      color,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Materia */}
      <div>
        <label className={labelCls}>Materia</label>
        {materias.length > 0 && (
          <select
            value={materiaId}
            onChange={(e) => {
              setMateriaId(e.target.value);
              const found = materias.find((m) => m.id === e.target.value);
              if (found) setMateriaNombre(found.nombre);
              else setMateriaNombre("");
            }}
            className={inputCls}
          >
            <option value="">— escribir nombre manualmente —</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        )}
        {(!materiaId || materias.length === 0) && (
          <input
            ref={nombreRef}
            type="text"
            value={materiaNombre}
            onChange={(e) => setMateriaNombre(e.target.value)}
            className={`${inputCls} ${materias.length > 0 ? "mt-2" : ""}`}
            placeholder="Nombre de la materia"
            autoFocus={!block}
            required
            maxLength={200}
          />
        )}
      </div>

      {/* Día + horario en una fila */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <label className={labelCls}>Día</label>
          <select
            value={dia}
            onChange={(e) => setDia(Number(e.target.value))}
            className={inputCls}
          >
            {DIAS_SEMANA.map((nombre, i) => (
              <option key={nombre} value={i + 1}>{nombre}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Desde</label>
          <select
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className={inputCls}
            required
          >
            {OPCIONES_HORA.filter((h) => h < "22:00").map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-zinc-500">Formato 24 hs</p>
        </div>
        <div className="min-w-0">
          <label className={labelCls}>Hasta</label>
          <select
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className={inputCls}
            required
          >
            {OPCIONES_HORA.filter((h) => h > "08:00").map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-zinc-500">Formato 24 hs</p>
        </div>
      </div>

      {/* Comisión + Color en una fila */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div className="min-w-0">
          <label className={labelCls}>Comisión (opcional)</label>
          <input
            type="text"
            value={comision}
            onChange={(e) => setComision(e.target.value)}
            className={inputCls}
            placeholder="Ej: A1, Turno tarde"
            maxLength={100}
          />
        </div>
        <div>
          <label className={labelCls}>Color</label>
          <div className="flex gap-1.5 pb-0.5">
            {BLOCK_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setColor(c.value)}
                className="h-7 w-7 rounded-full border-2 transition active:scale-90"
                style={{
                  backgroundColor: c.value,
                  borderColor: color === c.value ? "white" : "transparent",
                  boxShadow: color === c.value ? `0 0 0 1px ${c.value}` : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notas */}
      <div>
        <label className={labelCls}>Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className={`${inputCls} resize-none`}
          rows={2}
          maxLength={500}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Guardando..." : block ? "Guardar cambios" : "Agregar bloque"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 active:scale-95"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
