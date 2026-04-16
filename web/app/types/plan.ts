export type Requisito = {
  para_cursar: string | null;
  para_rendir: string | null;
};

export type Materia = {
  id: string;
  nombre: string;
  año: string | null;
  cuatrimestre: string | null;
  horas: string;
  tipo: string;
  categoria: "normal" | "optativa";
  grupo_opcion: string | null;
  subtipo: string | null;
  correlativas: Record<string, Requisito>;
};

export type Agrupador = {
  id: string;
  nombre: string;
  tipo: string;
  opciones: string[];
  orientacion?: string | null;
};

export type PlanInfo = {
  carrera: string;
  universidad: string;
  codigo_plan: string;
};

export type PlanData = {
  plan: PlanInfo;
  materias: Materia[];
  agrupadores: Agrupador[];
};