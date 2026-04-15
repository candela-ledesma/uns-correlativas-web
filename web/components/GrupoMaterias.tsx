"use client";

import MateriaCard from "@/components/MateriaCard";
import MateriasGrid from "@/components/MateriasGrid";
import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";

type Props = {
  titulo: string;
  grupoId: string;
  materias: Materia[];
  estados: Record<string, EstadoMateria>;
  todasLasMaterias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  onToggle: (materia: Materia, grupoId?: string) => void;
  onUndo: (materia: Materia, grupoId?: string) => void;
};

export default function GrupoMaterias({
  titulo,
  grupoId,
  materias,
  estados,
  todasLasMaterias,
  agrupadores,
  idsAgrupadores,
  onToggle,
  onUndo,
}: Props) {
  return (
    <section id={`grupo-${grupoId}`} className="mb-10 scroll-mt-24">
      <h2 className="mb-5 text-3xl font-bold tracking-tight text-zinc-900">
        {titulo}
      </h2>

      <MateriasGrid>
        {materias.map((materia) => {
          const vm = getMateriaViewModel({
            materia,
            estados,
            todasLasMaterias,
            agrupadores,
            idsAgrupadores,
            grupoIdRender: grupoId,
          });

          return (
            <MateriaCard
              key={`${grupoId}-${materia.id}`}
              data-testid={vm.testId}
              data-estado={vm.dataEstado}
              data-habilitada={vm.dataHabilitada}
              materia={materia}
              estado={vm.estado}
              puedeCursar={vm.puedeCursar}
              puedeAprobar={vm.puedeAprobar}
              puedeClickear={vm.puedeClickear}
              bloqueada={vm.bloqueada}
              onToggle={() => onToggle(materia, grupoId)}
              onUndo={() => onUndo(materia, grupoId)}
              undoTestId={`${vm.testId}-undo`}
            />
          );
        })}
      </MateriasGrid>
    </section>
  );
}