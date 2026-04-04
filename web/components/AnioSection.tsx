"use client";

import MateriaCard from "@/components/MateriaCard";
import MateriasGrid from "@/components/MateriasGrid";
import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";

type CuatrimestresMap = Record<string, Materia[]>;

type Props = {
    anio: string;
    cuatrimestres: CuatrimestresMap;
    estados: Record<string, EstadoMateria>;
    todasLasMaterias: Materia[];
    agrupadores: Agrupador[];
    idsAgrupadores: Set<string>;
    onToggle: (materia: Materia) => void;
};

export default function AnioSection({
    anio,
    cuatrimestres,
    estados,
    todasLasMaterias,
    agrupadores,
    idsAgrupadores,
    onToggle,
    }: Props) {
    return (
    <section className="mb-10">
        <h2 className="mb-5 text-4xl font-bold tracking-tight text-zinc-900">
        {anio}
        </h2>

        {Object.entries(cuatrimestres).map(([cuatrimestre, materias]) => (
        <div key={cuatrimestre} className="mb-7">
            <h3 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900">
            {cuatrimestre}
            </h3>

            <MateriasGrid>
            {materias.map((materia) => {
                const vm = getMateriaViewModel({
                materia,
                estados,
                todasLasMaterias,
                agrupadores,
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
        </div>
        ))}
    </section>
    );
}