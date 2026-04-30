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

  const tiposGrupo = new Set(["optativa_grupo", "idioma_grupo", "seminario_grupo"]);

  const agregarPuntero = (grupoId: string, anio: string, cuatrimestre: string, nombre: string) => {
    const clave = `${anio}::${cuatrimestre}::${grupoId}`;
    if (vistos.has(clave)) return;
    vistos.add(clave);
    if (!resultado[anio]) resultado[anio] = {};
    if (!resultado[anio][cuatrimestre]) resultado[anio][cuatrimestre] = [];
    resultado[anio][cuatrimestre].push({ grupoId, nombre });
  };

  // Paso 1: agrupadores con año/cuatrimestre explícitos en el JSON
  // (caso de colisión resuelta: el agrupador aparecía posicionado en el plan normal)
  for (const grupo of agrupadores) {
    if (!tiposGrupo.has(grupo.tipo)) continue;
    if (!grupo.año || !grupo.cuatrimestre) continue;
    agregarPuntero(String(grupo.id), grupo.año, grupo.cuatrimestre, grupo.nombre);
  }

  // Paso 2: agrupadores inferidos desde las materias que los referencian
  for (const materia of materiasFiltradas) {
    const grupoId = materia.grupo_opcion;
    if (!grupoId) continue;

    const grupo = agrupadores.find((a) => String(a.id) === String(grupoId));
    if (!grupo || !tiposGrupo.has(grupo.tipo)) continue;

    const placeholder          = materiasPorId.get(String(grupoId));
    const ubicacionPlaceholder = placeholder
      ? obtenerUbicacionPorOrientacion(placeholder, orientacionSeleccionada)
      : undefined;
    const ubicacionMateria     = obtenerUbicacionPorOrientacion(materia, orientacionSeleccionada);

    const anio         = ubicacionPlaceholder?.año          || placeholder?.año          || grupo.año          || ubicacionMateria?.año          || materia.año          || "Sin año";
    const cuatrimestre = ubicacionPlaceholder?.cuatrimestre || placeholder?.cuatrimestre || grupo.cuatrimestre || ubicacionMateria?.cuatrimestre || materia.cuatrimestre || "Sin cuatrimestre";

    agregarPuntero(String(grupoId), anio, cuatrimestre, grupo.nombre);
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
