"use client";

import MateriaCard from "@/components/materias/MateriaCard";
import AgrupadorCard from "@/components/materias/AgrupadorCard";
import MateriasGrid from "@/components/materias/MateriasGrid";
import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria, estadoAgrupador } from "@/lib/plan/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/plan/materiaViewModel";
import { obtenerCorrelativasMateria } from "@/lib/plan/correlativasMateria";

import { TEXT, TEXT_SEC, TITLE_SHADOW } from "@/lib/ui/tokens";

type CuatrimestresMap = Record<string, Materia[]>;
type PunteroGrupo = { grupoId: string; nombre: string };

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
    anio, cuatrimestres, punterosCuatrimestre = {}, estados,
    todasLasMaterias, agrupadores, idsAgrupadores, onToggle, onUndo,
}: Props) {
    const agrupadoresPorId = new Map(agrupadores.map((a) => [String(a.id), a]));

    return (
        <section className="mb-10">
            <h2 style={{ color: TEXT, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20, textShadow: TITLE_SHADOW }}>
                {anio}
            </h2>

            {Object.entries(cuatrimestres).map(([cuatrimestre, materias]) => {
                const punteros = punterosCuatrimestre[cuatrimestre] || [];
                const idsEnCronograma = new Set(materias.map((m) => String(m.id)));
                const punterosVisibles = punteros.filter((p) => !idsEnCronograma.has(String(p.grupoId)));
                const hayContenido = materias.length > 0 || punterosVisibles.length > 0;

                return (
                    <div key={cuatrimestre} className="mb-7">
                        <h3 style={{ color: TEXT_SEC, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 16 }}>
                            {cuatrimestre}
                        </h3>

                        {hayContenido && (
                            <MateriasGrid>
                                {materias.map((materia) => {
                                    const vm = getMateriaViewModel({ materia, estados, agrupadores, idsAgrupadores });
                                    const correlativas = obtenerCorrelativasMateria(materia, todasLasMaterias, agrupadores, estados);

                                    return (
                                        <MateriaCard
                                            key={materia.id}
                                            id={`materia-${materia.id}`}
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
                                            estados={estados}
                                            verCorrelativasTestId={`${vm.testId}-ver-correlativas`}
                                        />
                                    );
                                })}

                                {punterosVisibles.map((puntero) => {
                                    const grupo = agrupadoresPorId.get(String(puntero.grupoId));
                                    const tipo = grupo?.tipo ?? "optativa_grupo";
                                    const estadoGrupo = estadoAgrupador(puntero.grupoId, agrupadores, estados);
                                    return (
                                        <AgrupadorCard
                                            key={puntero.grupoId}
                                            grupoId={puntero.grupoId}
                                            nombre={puntero.nombre}
                                            tipo={tipo}
                                            estado={estadoGrupo}
                                        />
                                    );
                                })}
                            </MateriasGrid>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
