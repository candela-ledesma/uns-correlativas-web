"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { PlanData, Materia, Agrupador } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { usePlanStructure } from "@/hooks/usePlanStructure";
import AnioSection from "@/components/materias/AnioSection";
import GrupoMaterias from "@/components/materias/GrupoMaterias";
import { calcularProgresoPlan } from "@/lib/plan/calcularProgresoPlan";
import { getMateriaViewModel } from "@/lib/plan/materiaViewModel";
import {
  agruparPorAnioYCuatrimestre,
  construirPunterosGruposPorAnioYCuatrimestre,
  combinarSeccionesPorAnioYCuatrimestre,
} from "@/lib/plan/planAgrupacion";
import { TEXT, TEXT_SEC, SURFACE, TITLE_SHADOW, BTN } from "@/lib/ui/tokens";

const NOOP = () => {};

type Props = {
  data: PlanData;
  carreraId: string;
  sharedState: Record<string, EstadoMateria>;
  sharedAt: string;
};

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export default function ShareViewer({ data, carreraId, sharedState, sharedAt }: Props) {
  const agrupadores: Agrupador[] = useMemo(
    () => (Array.isArray(data.agrupadores) ? data.agrupadores : []),
    [data.agrupadores]
  );
  const { idsAgrupadores } = usePlanStructure(data);

  const materiasPorId = useMemo(() => {
    const m = new Map<string, Materia>();
    data.materias.forEach((mat) => m.set(String(mat.id), mat));
    return m;
  }, [data.materias]);

  const agrupadorTipoPorId = useMemo(
    () => new Map(agrupadores.map((a) => [String(a.id), a.tipo])),
    [agrupadores]
  );

  const agrupadas = useMemo(() => {
    const filtradas = data.materias.filter((m) => {
      if (m.grupo_opcion) return false;
      const id = String(m.id);
      const esAgrupador = idsAgrupadores.has(id);
      if (!esAgrupador) return true;
      const tipo = agrupadorTipoPorId.get(id);
      return tipo === "optativa_grupo" || tipo === "idioma_grupo" || tipo === "seminario_grupo";
    });
    return agruparPorAnioYCuatrimestre(filtradas, "todas");
  }, [data.materias, idsAgrupadores, agrupadorTipoPorId]);

  const punterosPorAnioYCuatrimestre = useMemo(
    () => construirPunterosGruposPorAnioYCuatrimestre(data.materias, agrupadores, materiasPorId, "todas"),
    [data.materias, agrupadores, materiasPorId]
  );

  const seccionesPorAnioYCuatrimestre = useMemo(
    () => combinarSeccionesPorAnioYCuatrimestre(agrupadas, punterosPorAnioYCuatrimestre),
    [agrupadas, punterosPorAnioYCuatrimestre]
  );

  const gruposIdiomas = agrupadores.filter((a) => a.tipo === "idioma_grupo");
  const gruposOptativas = agrupadores.filter((a) => a.tipo === "optativa_grupo");
  const gruposSeminarios = agrupadores.filter((a) => a.tipo === "seminario_grupo");

  const obtenerMateriasDeGrupo = (grupoId: string): Materia[] => {
    const grupo = agrupadores.find((a) => a.id === grupoId);
    if (!grupo) return [];
    return grupo.opciones
      .map((id) => materiasPorId.get(String(id)))
      .filter((m): m is Materia => Boolean(m));
  };

  const disponibles = data.materias.filter((materia) => {
    const vm = getMateriaViewModel({ materia, estados: sharedState, agrupadores, idsAgrupadores });
    return vm.puedeCursar && vm.estado === "no_cursada";
  }).length;

  const progreso = calcularProgresoPlan(data.materias, agrupadores, sharedState, disponibles);
  const porcentaje = progreso.total > 0 ? Math.round((progreso.aprobadas / progreso.total) * 100) : 0;

  const titulo = data.plan.carrera ?? carreraId;
  const subtitulo = data.plan.universidad ?? undefined;

  return (
    <div>
      {/* Banner de modo lectura */}
      <div style={{
        ...SURFACE, borderRadius: 12, padding: "10px 18px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        borderColor: "rgba(167,139,250,0.3)",
      }}>
        <span style={{ fontSize: 13, color: TEXT_SEC }}>
          Vista compartida — solo lectura · compartido {tiempoRelativo(sharedAt)}
        </span>
        <Link
          href={`/planes/${carreraId}`}
          style={{ ...BTN, borderRadius: 8, padding: "4px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
        >
          Abrir mi plan
        </Link>
      </div>

      {/* Header */}
      <header style={{ marginBottom: 36 }}>
        <h1 style={{ color: TEXT, fontSize: "clamp(1.6rem,4vw,3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8, textShadow: TITLE_SHADOW, wordBreak: "break-word" }}>
          {titulo}
        </h1>
        {subtitulo && <p style={{ color: TEXT_SEC, fontSize: 14, margin: "0 0 20px" }}>{subtitulo}</p>}

        {/* Barra de progreso */}
        <div style={{ ...SURFACE, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: TEXT_SEC, fontSize: 13, marginBottom: 4 }}>Progreso</div>
              <div style={{ color: TEXT, fontSize: 20, fontWeight: 800 }}>{porcentaje}% aprobado</div>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "Aprobadas", value: progreso.aprobadas, color: "#90be6d" },
                { label: "Cursadas", value: progreso.cursadas, color: "#4cc9f0" },
                { label: "Disponibles", value: progreso.disponibles, color: "#f9c74f" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ color, fontSize: 20, fontWeight: 800 }}>{value}</div>
                  <div style={{ color: TEXT_SEC, fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height: 8, width: "100%", borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #90be6d, #43aa8b)", width: `${porcentaje}%` }} />
          </div>
        </div>
      </header>

      {/* Plan en lectura */}
      <div style={{ pointerEvents: "none", userSelect: "none" }}>
        {Object.entries(seccionesPorAnioYCuatrimestre).map(([anio, cuatrimestresMap]) => (
          <AnioSection
            key={anio}
            anio={anio}
            cuatrimestres={cuatrimestresMap}
            punterosCuatrimestre={punterosPorAnioYCuatrimestre[anio] || {}}
            estados={sharedState}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={NOOP}
            onUndo={NOOP}
          />
        ))}

        {[...gruposIdiomas, ...gruposSeminarios, ...gruposOptativas].map((grupo) => {
          const materias = obtenerMateriasDeGrupo(grupo.id);
          if (materias.length === 0) return null;
          const esTitulo = grupo.tipo === "optativa_grupo"
            ? `${grupo.nombre} (${grupo.id})`
            : grupo.nombre;
          return (
            <GrupoMaterias
              key={grupo.id}
              titulo={esTitulo}
              grupoId={grupo.id}
              materias={materias}
              estados={sharedState}
              todasLasMaterias={data.materias}
              agrupadores={agrupadores}
              idsAgrupadores={idsAgrupadores}
              onToggle={NOOP}
              onUndo={NOOP}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 32, textAlign: "center", color: TEXT_SEC, fontSize: 11, opacity: 0.5 }}>
        Vista de solo lectura · los clicks están deshabilitados
      </div>
    </div>
  );
}
