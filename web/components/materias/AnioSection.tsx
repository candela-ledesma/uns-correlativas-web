"use client";

import MateriaCard from "@/components/materias/MateriaCard";
import MateriasGrid from "@/components/materias/MateriasGrid";
import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/materiaViewModel";
import { obtenerCorrelativasMateria } from "@/lib/correlativasMateria";

import { TEXT, TEXT_SEC, TITLE_SHADOW } from "@/lib/tokens";

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
    return (
        <section className="mb-10">
            <h2 style={{ color: TEXT, fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 20, textShadow: TITLE_SHADOW }}>
                {anio}
            </h2>

            {Object.entries(cuatrimestres).map(([cuatrimestre, materias]) => {
                const punteros = punterosCuatrimestre[cuatrimestre] || [];
                const idsEnCronograma = new Set(materias.map((m) => String(m.id)));
                const punterosVisibles = punteros.filter((p) => !idsEnCronograma.has(String(p.grupoId)));

                return (
                    <div key={cuatrimestre} className="mb-7">
                        <h3 style={{ color: TEXT_SEC, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 16 }}>
                            {cuatrimestre}
                        </h3>

                        {materias.length > 0 && (
                            <MateriasGrid>
                                {materias.map((materia) => {
                                    const vm = getMateriaViewModel({ materia, estados, agrupadores, idsAgrupadores });
                                    const correlativas = obtenerCorrelativasMateria(materia, todasLasMaterias, agrupadores, estados);

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
                            <div style={{ marginTop: 12, borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
                                <p style={{ color: TEXT_SEC, fontSize: 13, fontWeight: 600, marginBottom: 8, margin: "0 0 8px" }}>
                                    También podés cursar materias agrupadas en este cuatrimestre:
                                </p>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {punterosVisibles.map((puntero) => (
                                        <a
                                            key={puntero.grupoId}
                                            data-testid={`puntero-grupo-${puntero.grupoId}`}
                                            href={`#grupo-${puntero.grupoId}`}
                                            style={{ display: "inline-flex", alignItems: "center", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: TEXT, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", textDecoration: "none" }}
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
