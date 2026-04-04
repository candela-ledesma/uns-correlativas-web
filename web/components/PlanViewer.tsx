"use client";

import { PlanData, Materia } from "@/app/types/plan";
import PlanHeader from "@/components/PlanHeader";
import AnioSection from "@/components/AnioSection";
import GrupoMaterias from "@/components/GrupoMaterias";
import { usePlanState } from "@/hooks/usePlanState";
import { usePlanStructure } from "@/hooks/usePlanStructure";
import { getMateriaViewModel } from "@/lib/materiaViewModel";
import { calcularProgresoPlan } from "@/lib/calcularProgresoPlan";

type Props = {
  data: PlanData;
};

export default function PlanViewer({ data }: Props) {
  const {
    agrupadas,
    idsAgrupadores,
  } = usePlanStructure(data);

  const agrupadores = data.agrupadores || [];
  const materiasPorId = new Map(
    data.materias.map((m) => [String(m.id), m])
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

  const { estados, toggleMateria, resetMaterias } = usePlanState(agrupadores);

  const titulo = data.plan.carrera;
  const subtitulo = `Plan ${data.plan.universidad} ${data.plan.codigo_plan}`;

  const disponibles = data.materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: data.materias,
      agrupadores: data.agrupadores,
      idsAgrupadores,
    });

    return vm.habilitada && vm.estado === "no_cursada";
  }).length;

  const progreso = calcularProgresoPlan(
    data.materias,
    data.agrupadores,
    estados,
    disponibles
  );

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

      {Object.entries(agrupadas).map(([anio, cuatrimestres]) => (
        <AnioSection
          key={anio}
          anio={anio}
          cuatrimestres={cuatrimestres}
          estados={estados}
          todasLasMaterias={data.materias}
          agrupadores={data.agrupadores}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
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
            agrupadores={data.agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
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
            agrupadores={data.agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
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
            agrupadores={data.agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
          />
        );
      })}
    </main>
  );
}