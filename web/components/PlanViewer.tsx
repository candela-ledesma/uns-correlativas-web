"use client";

import { PlanData } from "@/app/types/plan";
import PlanHeader from "@/components/PlanHeader";
import AnioSection from "@/components/AnioSection";
import GrupoMaterias from "@/components/GrupoMaterias";
import { usePlanState } from "@/hooks/usePlanState";
import { usePlanStructure } from "@/hooks/usePlanStructure";

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

  const {
    estados,
    toggleMateria,
    resetMaterias,
    isHydrated,
  } = usePlanState(idsAgrupadores);


  const titulo = data.plan?.carrera || "Plan de estudios";
  const subtitulo = [
    data.plan?.universidad,
    data.plan?.codigo_plan,
  ]
    .filter(Boolean)
    .join(" — ");

    if (!isHydrated) {
      return (
        <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
          <PlanHeader
            titulo={titulo}
            subtitulo={subtitulo}
            onReset={resetMaterias}
          />
          <p>Cargando plan...</p>
        </main>
      );
    }

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
      <PlanHeader
        titulo={titulo}
        subtitulo={subtitulo}
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

      <GrupoMaterias
        titulo="Idiomas"
        grupoId="I2201"
        materias={idiomas}
        estados={estados}
        todasLasMaterias={data.materias}
        idsAgrupadores={idsAgrupadores}
        onToggle={toggleMateria}
      />

      <GrupoMaterias
        titulo="Seminarios"
        grupoId="seminarios"
        materias={seminarios}
        estados={estados}
        todasLasMaterias={data.materias}
        idsAgrupadores={idsAgrupadores}
        onToggle={toggleMateria}
      />

      <GrupoMaterias
        titulo="Materias optativas"
        grupoId="G2324"
        materias={optativas}
        estados={estados}
        todasLasMaterias={data.materias}
        idsAgrupadores={idsAgrupadores}
        onToggle={toggleMateria}
      />
    </main>
  );
}