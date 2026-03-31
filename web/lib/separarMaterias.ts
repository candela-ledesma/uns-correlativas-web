import { Materia, Agrupador } from "../app/types/plan";

export function separarMaterias(materias: Materia[], agrupadores: Agrupador[]) {
  const gruposPorId = new Map(agrupadores.map((a) => [a.id, a]));

  const normales = materias.filter((m) => m.categoria === "normal");

  const opcionesDeGrupo = materias.filter(
    (m) => m.categoria === "optativa" && m.grupo_opcion
  );

  const optativas = opcionesDeGrupo.filter((m) => {
    const grupo = gruposPorId.get(m.grupo_opcion!);
    return grupo?.tipo === "optativa_grupo";
  });

  const idiomas = opcionesDeGrupo.filter((m) => {
    const grupo = gruposPorId.get(m.grupo_opcion!);
    return grupo?.tipo === "idioma_grupo";
  });

  const seminarios = opcionesDeGrupo.filter((m) => {
    const grupo = gruposPorId.get(m.grupo_opcion!);
    return grupo?.tipo === "seminario_grupo";
  });

  return { normales, optativas, idiomas, seminarios };
}