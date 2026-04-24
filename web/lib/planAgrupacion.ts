import type { Materia, Agrupador } from "@/app/types/plan";

export type PunteroGrupo = { grupoId: string; nombre: string };

export function obtenerUbicacionPorOrientacion(materia: Materia, orientacionSeleccionada: string) {
  if (orientacionSeleccionada === "todas") return undefined;
  return materia.ubicacion?.[orientacionSeleccionada];
}

export function agruparPorAnioYCuatrimestre(
  materias: Materia[],
  orientacionSeleccionada: string
): Record<string, Record<string, Materia[]>> {
  const resultado: Record<string, Record<string, Materia[]>> = {};

  for (const materia of materias) {
    const ubicacion     = obtenerUbicacionPorOrientacion(materia, orientacionSeleccionada);
    const anio          = ubicacion?.año          || materia.año          || "Sin año";
    const cuatrimestre  = ubicacion?.cuatrimestre || materia.cuatrimestre || "Sin cuatrimestre";

    if (!resultado[anio]) resultado[anio] = {};
    if (!resultado[anio][cuatrimestre]) resultado[anio][cuatrimestre] = [];
    resultado[anio][cuatrimestre].push(materia);
  }

  return resultado;
}

export function construirPunterosGruposPorAnioYCuatrimestre(
  materiasFiltradas: Materia[],
  agrupadores: Agrupador[],
  materiasPorId: Map<string, Materia>,
  orientacionSeleccionada: string
): Record<string, Record<string, PunteroGrupo[]>> {
  const resultado: Record<string, Record<string, PunteroGrupo[]>> = {};
  const vistos = new Set<string>();

  for (const materia of materiasFiltradas) {
    const grupoId = materia.grupo_opcion;
    if (!grupoId) continue;

    const grupo = agrupadores.find((a) => String(a.id) === String(grupoId));
    if (!grupo) continue;

    if (
      grupo.tipo !== "optativa_grupo" &&
      grupo.tipo !== "idioma_grupo" &&
      grupo.tipo !== "seminario_grupo"
    ) continue;

    const placeholder          = materiasPorId.get(String(grupoId));
    const ubicacionPlaceholder = placeholder
      ? obtenerUbicacionPorOrientacion(placeholder, orientacionSeleccionada)
      : undefined;
    const ubicacionMateria     = obtenerUbicacionPorOrientacion(materia, orientacionSeleccionada);

    const anio         = ubicacionPlaceholder?.año          || placeholder?.año          || ubicacionMateria?.año          || materia.año          || "Sin año";
    const cuatrimestre = ubicacionPlaceholder?.cuatrimestre || placeholder?.cuatrimestre || ubicacionMateria?.cuatrimestre || materia.cuatrimestre || "Sin cuatrimestre";

    if (!resultado[anio]) resultado[anio] = {};
    if (!resultado[anio][cuatrimestre]) resultado[anio][cuatrimestre] = [];

    const clave = `${anio}::${cuatrimestre}::${grupoId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    resultado[anio][cuatrimestre].push({ grupoId: String(grupoId), nombre: grupo.nombre });
  }

  return resultado;
}

export function combinarSeccionesPorAnioYCuatrimestre(
  materiasAgrupadas: Record<string, Record<string, Materia[]>>,
  punteros: Record<string, Record<string, PunteroGrupo[]>>
): Record<string, Record<string, Materia[]>> {
  const anios = new Set([...Object.keys(materiasAgrupadas), ...Object.keys(punteros)]);
  const resultado: Record<string, Record<string, Materia[]>> = {};

  for (const anio of anios) {
    const cuatrimestresMaterias = materiasAgrupadas[anio] || {};
    const cuatrimestresPunteros = punteros[anio] || {};
    const cuatrimestres = new Set([
      ...Object.keys(cuatrimestresMaterias),
      ...Object.keys(cuatrimestresPunteros),
    ]);

    resultado[anio] = {};
    for (const cuatrimestre of cuatrimestres) {
      resultado[anio][cuatrimestre] = cuatrimestresMaterias[cuatrimestre] || [];
    }
  }

  return resultado;
}
