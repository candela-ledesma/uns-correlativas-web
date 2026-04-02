"use client";

import MateriaCard from "@/components/MateriaCard";
import MateriasGrid from "@/components/MateriasGrid";
import { Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";

type Props = {
    titulo: string;
    grupoId: string;
    materias: Materia[];
    estados: Record<string, EstadoMateria>;
    todasLasMaterias: Materia[];
    idsAgrupadores: Set<string>;
    onToggle: (materia: Materia) => void;
};

export default function GrupoMaterias({
    titulo,
    grupoId,
    materias,
    estados,
    todasLasMaterias,
    idsAgrupadores,
    onToggle,
    }: Props) {
    if (materias.length === 0) return null;

    return (
    <section
        id={`grupo-${grupoId}`}
        data-testid={`grupo-${grupoId}`}
        style={{ marginTop: "36px" }}
    >
        <h2 style={{ marginBottom: "16px" }}>{titulo}</h2>

        <MateriasGrid>
        {materias.map((materia) => {
            const vm = getMateriaViewModel({
            materia,
            estados,
            todasLasMaterias,
            idsAgrupadores,
            });

            return (
            <MateriaCard
                key={materia.id}
                data-testid={vm.testId}
                data-estado={vm.dataEstado}
                data-habilitada={vm.dataHabilitada}
                materia={materia}
                estado={vm.estado}
                habilitada={vm.habilitada}
                bloqueada={vm.bloqueada}
                onClick={() => onToggle(materia)}
            />
            );
        })}
        </MateriasGrid>
    </section>
    );
}