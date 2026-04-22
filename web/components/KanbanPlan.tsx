"use client";

import { useRef, useState } from "react";

type Materia = {
  id: string;
  nombre: string;
  creditos?: number;
};

type Columna = {
  id: string;
  titulo: string;
  materias: Materia[];
};

const ANIOS = [
  "Primer Año",
  "Segundo Año",
  "Tercer Año",
  "Cuarto Año",
  "Quinto Año",
];

function crearColumnas(): Columna[] {
  return ANIOS.map((titulo, i) => ({
    id: `anio-${i + 1}`,
    titulo,
    materias: [],
  }));
}

function crearMateria(nombre: string): Materia {
  return { id: crypto.randomUUID(), nombre: nombre.trim() };
}

function totalCreditos(materias: Materia[]): number {
  return materias.reduce((sum, m) => sum + (m.creditos ?? 0), 0);
}

type DragRef = {
  materiaId: string;
  fromColumnaId: string;
};

export default function KanbanPlan() {
  const [columnas, setColumnas] = useState<Columna[]>(crearColumnas);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [editandoCreditos, setEditandoCreditos] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<DragRef | null>(null);

  function agregarMateria(columnaId: string) {
    const nombre = "Nueva materia";
    const nueva = crearMateria(nombre);
    setColumnas((prev) =>
      prev.map((col) =>
        col.id === columnaId
          ? { ...col, materias: [...col.materias, nueva] }
          : col
      )
    );
    iniciarEdicion(nueva);
  }

  function eliminarMateria(columnaId: string, materiaId: string) {
    setColumnas((prev) =>
      prev.map((col) =>
        col.id === columnaId
          ? { ...col, materias: col.materias.filter((m) => m.id !== materiaId) }
          : col
      )
    );
    if (editandoId === materiaId) setEditandoId(null);
  }

  function iniciarEdicion(materia: Materia) {
    setEditandoId(materia.id);
    setEditandoNombre(materia.nombre);
    setEditandoCreditos(materia.creditos !== undefined ? String(materia.creditos) : "");
  }

  function guardarEdicion() {
    if (!editandoId) return;
    const nombre = editandoNombre.trim() || "Sin nombre";
    const creditos = parseInt(editandoCreditos, 10);
    setColumnas((prev) =>
      prev.map((col) => ({
        ...col,
        materias: col.materias.map((m) =>
          m.id === editandoId
            ? { ...m, nombre, creditos: isNaN(creditos) ? undefined : creditos }
            : m
        ),
      }))
    );
    setEditandoId(null);
  }

  function handleDragStart(materiaId: string, fromColumnaId: string) {
    dragRef.current = { materiaId, fromColumnaId };
  }

  function handleDrop(toColumnaId: string) {
    const drag = dragRef.current;
    if (!drag) return;
    setDragOver(null);

    if (drag.fromColumnaId === toColumnaId) return;

    setColumnas((prev) => {
      const materia = prev
        .find((c) => c.id === drag.fromColumnaId)
        ?.materias.find((m) => m.id === drag.materiaId);
      if (!materia) return prev;

      return prev.map((col) => {
        if (col.id === drag.fromColumnaId) {
          return { ...col, materias: col.materias.filter((m) => m.id !== drag.materiaId) };
        }
        if (col.id === toColumnaId) {
          return { ...col, materias: [...col.materias, materia] };
        }
        return col;
      });
    });

    dragRef.current = null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Plan de estudio</h1>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnas.map((col) => {
          const creditos = totalCreditos(col.materias);
          const isDragOver = dragOver === col.id;

          return (
            <div
              key={col.id}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-white shadow-sm transition ${
                isDragOver ? "border-blue-400 ring-2 ring-blue-200" : "border-zinc-200"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOver(null);
                }
              }}
              onDrop={() => handleDrop(col.id)}
            >
              {/* Column header */}
              <div className="rounded-t-2xl border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="font-bold text-zinc-900">{col.titulo}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {col.materias.length} materias
                  {creditos > 0 && ` · ${creditos} créditos`}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 p-3">
                {col.materias.map((materia) => (
                  <div
                    key={materia.id}
                    draggable
                    onDragStart={() => handleDragStart(materia.id, col.id)}
                    onDragEnd={() => setDragOver(null)}
                    className="group relative rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:shadow-md cursor-grab active:cursor-grabbing"
                  >
                    {editandoId === materia.id ? (
                      <div
                        className="flex flex-col gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          value={editandoNombre}
                          onChange={(e) => setEditandoNombre(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") guardarEdicion();
                            if (e.key === "Escape") setEditandoId(null);
                          }}
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm font-semibold text-zinc-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="Nombre de la materia"
                        />
                        <input
                          type="number"
                          min={0}
                          value={editandoCreditos}
                          onChange={(e) => setEditandoCreditos(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") guardarEdicion();
                            if (e.key === "Escape") setEditandoId(null);
                          }}
                          className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          placeholder="Créditos (opcional)"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditandoId(null)}
                            className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={guardarEdicion}
                            className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="Eliminar materia"
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarMateria(col.id, materia.id);
                          }}
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 opacity-0 transition hover:bg-red-100 hover:text-red-500 group-hover:opacity-100"
                        >
                          ✕
                        </button>

                        <div
                          onDoubleClick={() => iniciarEdicion(materia)}
                          className="cursor-text select-none"
                          title="Doble clic para editar"
                        >
                          <div className="pr-5 text-sm font-semibold leading-5 text-zinc-900">
                            {materia.nombre}
                          </div>
                          {materia.creditos !== undefined && (
                            <div className="mt-1 text-xs text-zinc-500">
                              {materia.creditos} créditos
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => agregarMateria(col.id)}
                  className="mt-1 flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                >
                  <span className="text-base leading-none">+</span>
                  Agregar materia
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
