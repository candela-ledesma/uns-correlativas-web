"use client";

import { PlanData } from "@/app/types/plan";
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
    optativas,
    idiomas,
    seminarios,
    idsAgrupadores,
  } = usePlanStructure(data);

  const agrupadores = data.agrupadores || [];

  const idiomaGroup = agrupadores.find((a) => a.tipo === "idioma_grupo");
  const optativaGroup = agrupadores.find((a) => a.tipo === "optativa_grupo");
  const seminarioGroup = agrupadores.find((a) => a.tipo === "seminario_grupo");

  const { estados, toggleMateria, resetMaterias } = usePlanState(agrupadores);

  const titulo = data.plan.carrera;
  const subtitulo = `Plan ${data.plan.universidad} ${data.plan.codigo_plan}`;

  const disponibles = data.materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: data.materias,
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
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
        />
      ))}

      {idiomas.length > 0 && idiomaGroup && (
        <GrupoMaterias
          titulo="Idiomas"
          grupoId={idiomaGroup.id}
          materias={idiomas}
          estados={estados}
          todasLasMaterias={data.materias}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
        />
      )}

      {seminarios.length > 0 && (
        <GrupoMaterias
          titulo="Seminarios"
          grupoId={seminarioGroup?.id ?? "seminarios"}
          materias={seminarios}
          estados={estados}
          todasLasMaterias={data.materias}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
        />
      )}

      {optativas.length > 0 && optativaGroup && (
        <GrupoMaterias
          titulo="Materias optativas"
          grupoId={optativaGroup.id}
          materias={optativas}
          estados={estados}
          todasLasMaterias={data.materias}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
        />
      )}
    </main>
  );
}