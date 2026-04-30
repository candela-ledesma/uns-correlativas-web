export type Requisito = {
  para_cursar: string | null;
  para_rendir: string | null;
};

export type RequisitoEspecial = {
  tipo: "minimo_materias_aprobadas";
  cantidad: number;
  descripcion: string;
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
  orientacion?: string | null;
  orientaciones?: string[];
  ubicacion?: Record<string, { año: string | null; cuatrimestre: string | null }>;
  subtipo: string | null;
  correlativas: Record<string, Requisito>;
  requisito_especial?: RequisitoEspecial | null;
};

export type Agrupador = {
  id: string;
  nombre: string;
  tipo: string;
  opciones: string[];
  orientacion?: string | null;
  año?: string | null;
  cuatrimestre?: string | null;
};

export type PlanInfo = {
  carrera: string;
  universidad: string;
  codigo_plan: string;
  plan_id: string;
  version_id: string;
};

export type PlanData = {
  plan: PlanInfo;
  materias: Materia[];
  agrupadores: Agrupador[];
};