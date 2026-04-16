"use client";

import { useMemo, useState } from "react";
import { PlanData, Materia } from "@/app/types/plan";
import PlanHeader from "@/components/PlanHeader";
import PlanFilters from "@/components/PlanFilters";
import AnioSection from "@/components/AnioSection";
import GrupoMaterias from "@/components/GrupoMaterias";
import { usePlanState } from "@/hooks/usePlanState";
import { usePlanStructure } from "@/hooks/usePlanStructure";
import { getMateriaViewModel } from "@/lib/materiaViewModel";
import { calcularProgresoPlan } from "@/lib/calcularProgresoPlan";
import { filtrarMaterias, type FiltrosPlan } from "@/lib/filtrarMaterias";

type Props = {
  data: PlanData;
};

const FILTROS_INICIALES: FiltrosPlan = {
  codigo: "",
  anio: "todos",
  cuatrimestre: "todos",
  estado: "todas",
};

function agruparPorAnioYCuatrimestre(materias: Materia[]) {
  const resultado: Record<string, Record<string, Materia[]>> = {};

  for (const materia of materias) {
    const anio = materia.año || "Sin año";
    const cuatrimestre = materia.cuatrimestre || "Sin cuatrimestre";

    if (!resultado[anio]) {
      resultado[anio] = {};
    }

    if (!resultado[anio][cuatrimestre]) {
      resultado[anio][cuatrimestre] = [];
    }

    resultado[anio][cuatrimestre].push(materia);
  }

  return resultado;
}

export default function PlanViewer({ data }: Props) {
  const { idsAgrupadores } = usePlanStructure(data);

  const agrupadores = data.agrupadores || [];
  const materiasPorId = new Map(
    data.materias.map((m) => [String(m.id), m])
  );

  const [filtros, setFiltros] = useState<FiltrosPlan>({
    ...FILTROS_INICIALES,
  });

  const canResetFiltros = filtros.codigo !== FILTROS_INICIALES.codigo
    || filtros.anio !== FILTROS_INICIALES.anio
    || filtros.cuatrimestre !== FILTROS_INICIALES.cuatrimestre
    || filtros.estado !== FILTROS_INICIALES.estado;

  function resetFiltros() {
    setFiltros({ ...FILTROS_INICIALES });
  }

  const {
    estados,
    toggleMateria,
    deshacerMateria,
    resetMaterias,
    isHydrated,
  } =
    usePlanState(data.materias, agrupadores);

  const titulo = data.plan.carrera;
  const subtitulo = `Plan ${data.plan.universidad} ${data.plan.codigo_plan}`;

  const anios = useMemo(() => {
    return Array.from(
      new Set(data.materias.map((m) => m.año).filter(Boolean))
    ) as string[];
  }, [data.materias]);

  const cuatrimestres = useMemo(() => {
    return Array.from(
      new Set(data.materias.map((m) => m.cuatrimestre).filter(Boolean))
    ) as string[];
  }, [data.materias]);

  const materiasFiltradas = useMemo(() => {
    return filtrarMaterias({
      materias: data.materias,
      estados,
      agrupadores,
      idsAgrupadores,
      filtros,
    });
  }, [data.materias, estados, agrupadores, idsAgrupadores, filtros]);

  const agrupadas = useMemo(() => {
    return agruparPorAnioYCuatrimestre(
      materiasFiltradas.filter((m) => !idsAgrupadores.has(String(m.id)))
    );
  }, [materiasFiltradas, idsAgrupadores]);

  const gruposIdiomas = agrupadores.filter((a) => a.tipo === "idioma_grupo");
  const gruposOptativas = agrupadores.filter((a) => a.tipo === "optativa_grupo");
  const gruposSeminarios = agrupadores.filter((a) => a.tipo === "seminario_grupo");

  const obtenerMateriasDeGrupo = (grupoId: string): Materia[] => {
    const grupo = agrupadores.find((a) => a.id === grupoId);
    if (!grupo) return [];

    return grupo.opciones
      .map((id) => materiasPorId.get(String(id)))
      .filter((m): m is Materia => Boolean(m))
      .filter((m) => materiasFiltradas.some((mf) => String(mf.id) === String(m.id)));
  };

  const disponibles = data.materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: data.materias,
      agrupadores,
      idsAgrupadores,
    });

    return vm.puedeCursar && vm.estado === "no_cursada";
  }).length;

  const progreso = calcularProgresoPlan(
    data.materias,
    agrupadores,
    estados,
    disponibles
  );

  if (!isHydrated) return null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <PlanHeader
        titulo={titulo}
        subtitulo={subtitulo}
        aprobadas={progreso.aprobadas}
        cursadas={progreso.cursadas}
        disponibles={progreso.disponibles}
        total={progreso.total}
        onReset={resetMaterias}
      />

      <PlanFilters
        filtros={filtros}
        onChange={setFiltros}
        onReset={resetFiltros}
        canReset={canResetFiltros}
        anios={anios}
        cuatrimestres={cuatrimestres}
      />

      {Object.entries(agrupadas).map(([anio, cuatrimestresMap]) => (
        <AnioSection
          key={anio}
          anio={anio}
          cuatrimestres={cuatrimestresMap}
          estados={estados}
          todasLasMaterias={data.materias}
          agrupadores={agrupadores}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
          onUndo={deshacerMateria}
        />
      ))}

      {gruposIdiomas.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={grupo.nombre}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}

      {gruposSeminarios.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={grupo.nombre}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}

      {gruposOptativas.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={`${grupo.nombre} (${grupo.id})`}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}
    </main>
  );
}