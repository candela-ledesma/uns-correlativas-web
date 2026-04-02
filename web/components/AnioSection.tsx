"use client";

import MateriaCard from "@/components/MateriaCard";
import MateriasGrid from "@/components/MateriasGrid";
import { Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";

type CuatrimestresMap = Record<string, Materia[]>;

type Props = {
    anio: string;
    cuatrimestres: CuatrimestresMap;
    estados: Record<string, EstadoMateria>;
    todasLasMaterias: Materia[];
    idsAgrupadores: Set<string>;
    onToggle: (materia: Materia) => void;
};

export default function AnioSection({
    anio,
    cuatrimestres,
    estados,
    todasLasMaterias,
    idsAgrupadores,
    onToggle,
    }: Props) {
    return (
    <section style={{ marginBottom: "40px" }}>
        <h2 style={{ marginBottom: "20px" }}>{anio}</h2>

        {Object.entries(cuatrimestres).map(([cuatrimestre, materias]) => (
        <div key={cuatrimestre} style={{ marginBottom: "28px" }}>
            <h3 style={{ marginBottom: "14px" }}>{cuatrimestre}</h3>

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
        </div>
        ))}
    </section>
    );
}