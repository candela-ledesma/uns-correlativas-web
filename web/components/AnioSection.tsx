"use client";

import MateriaCard from "@/components/MateriaCard";
import MateriasGrid from "@/components/MateriasGrid";
import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";
import { obtenerCorrelativasMateria } from "@/lib/correlativasMateria";

type CuatrimestresMap = Record<string, Materia[]>;
type PunteroGrupo = {
    grupoId: string;
    nombre: string;
};

type Props = {
    anio: string;
    cuatrimestres: CuatrimestresMap;
    punterosCuatrimestre?: Record<string, PunteroGrupo[]>;
    estados: Record<string, EstadoMateria>;
    todasLasMaterias: Materia[];
    agrupadores: Agrupador[];
    idsAgrupadores: Set<string>;
    onToggle: (materia: Materia, grupoId?: string) => void;
    onUndo: (materia: Materia, grupoId?: string) => void;
};

export default function AnioSection({
    anio,
    cuatrimestres,
    punterosCuatrimestre = {},
    estados,
    todasLasMaterias,
    agrupadores,
    idsAgrupadores,
    onToggle,
    onUndo,
    }: Props) {
    return (
    <section className="mb-10">
        <h2 className="mb-5 text-4xl font-bold tracking-tight text-zinc-900">
        {anio}
        </h2>

                {Object.entries(cuatrimestres).map(([cuatrimestre, materias]) => {
                    const punteros = punterosCuatrimestre[cuatrimestre] || [];
                    const idsEnCronograma = new Set(materias.map((m) => String(m.id)));
                    const punterosVisibles = punteros.filter(
                      (p) => !idsEnCronograma.has(String(p.grupoId))
                    );

                    return (
                <div key={cuatrimestre} className="mb-7">
            <h3 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900">
            {cuatrimestre}
            </h3>

                        {materias.length > 0 && (
                            <MateriasGrid>
                            {materias.map((materia) => {
                const vm = getMateriaViewModel({
                materia,
                estados,
                agrupadores,
                idsAgrupadores,
                });
                                const correlativas = obtenerCorrelativasMateria(
                                    materia,
                                    todasLasMaterias,
                                    agrupadores,
                                    estados
                                );

                return (
                <MateriaCard
                    key={materia.id}
                    data-testid={vm.testId}
                    data-estado={vm.dataEstado}
                    data-habilitada={vm.dataHabilitada}
                    materia={materia}
                    estado={vm.estado}
                    puedeCursar={vm.puedeCursar}
                    puedeAprobar={vm.puedeAprobar}
                    puedeClickear={vm.puedeClickear}
                    bloqueada={vm.bloqueada}
                    onToggle={() => onToggle(materia)}
                    onUndo={() => onUndo(materia)}
                    undoTestId={`${vm.testId}-undo`}
                    correlativas={correlativas}
                    verCorrelativasTestId={`${vm.testId}-ver-correlativas`}
                    />
                );
                            })}
                            </MateriasGrid>
                        )}

                        {punterosVisibles.length > 0 && (
                            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                                <p className="mb-2 text-sm font-semibold text-zinc-700">
                                    Tambien podes cursar materias agrupadas en este cuatrimestre:
                                </p>

                                <div className="flex flex-wrap gap-2">
                                    {punterosVisibles.map((puntero) => (
                                        <a
                                            key={puntero.grupoId}
                                            data-testid={`puntero-grupo-${puntero.grupoId}`}
                                            href={`#grupo-${puntero.grupoId}`}
                                            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
                                        >
                                            Ver {puntero.nombre}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
        </div>
                );
                })}
    </section>
    );
}