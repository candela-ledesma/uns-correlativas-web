"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlanData, Materia } from "@/app/types/plan";
import PlanHeader from "@/components/PlanHeader";
import PlanFilters from "@/components/PlanFilters";
import AnioSection from "@/components/AnioSection";
import GrupoMaterias from "@/components/GrupoMaterias";
import PlanOnboarding from "@/components/PlanOnboarding";
import { usePlanState } from "@/hooks/usePlanState";
import { usePlanStructure } from "@/hooks/usePlanStructure";
import { getMateriaViewModel } from "@/lib/materiaViewModel";
import { calcularProgresoPlan } from "@/lib/calcularProgresoPlan";
import { filtrarMaterias, type FiltrosPlan } from "@/lib/filtrarMaterias";

type Props = {
  data: PlanData;
  carreraId: string;
  versionLabel: string;
  forceShowOnboarding?: boolean;
  defaultVersionId: string;
  versionOptions: {
    versionId: string;
    label: string;
    disponible?: boolean;
    hidden?: boolean;
  }[];
};

const FILTROS_INICIALES: FiltrosPlan = {
  codigo: "",
  anio: "todos",
  cuatrimestre: "todos",
  estado: "todas",
  orientacion: "todas",
};

function normalizarTexto(valor: string) {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function agruparPorAnioYCuatrimestre(materias: Materia[]) {
  const resultado: Record<string, Record<string, Materia[]>> = {};

  for (const materia of materias) {
    const anio = materia.año || "Sin año";
    const cuatrimestre = materia.cuatrimestre || "Sin cuatrimestre";

    if (!resultado[anio]) {
      resultado[anio] = {};
    }

    if (!resultado[anio][cuatrimestre]) {
      resultado[anio][cuatrimestre] = [];
    }

    resultado[anio][cuatrimestre].push(materia);
  }

  return resultado;
}

type PunteroGrupo = {
  grupoId: string;
  nombre: string;
};

function construirPunterosGruposPorAnioYCuatrimestre(
  materiasFiltradas: Materia[],
  agrupadores: PlanData["agrupadores"],
  materiasPorId: Map<string, Materia>
) {
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
    ) {
      continue;
    }

    // El cuatrimestre/año del puntero debe ser el del agrupador (Gxxxx / Ixxxx / etc),
    // porque en algunos PDFs las opciones vienen con slots inconsistentes.
    const placeholder = materiasPorId.get(String(grupoId));
    const anio = placeholder?.año ?? materia.año ?? "Sin año";
    const cuatrimestre =
      placeholder?.cuatrimestre ?? materia.cuatrimestre ?? "Sin cuatrimestre";

    if (!resultado[anio]) resultado[anio] = {};
    if (!resultado[anio][cuatrimestre]) resultado[anio][cuatrimestre] = [];

    const clave = `${anio}::${cuatrimestre}::${grupoId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    resultado[anio][cuatrimestre].push({
      grupoId: String(grupoId),
      nombre: grupo.nombre,
    });
  }

  return resultado;
}

function combinarSeccionesPorAnioYCuatrimestre(
  materiasAgrupadas: Record<string, Record<string, Materia[]>>,
  punteros: Record<string, Record<string, PunteroGrupo[]>>
) {
  const anios = new Set([
    ...Object.keys(materiasAgrupadas),
    ...Object.keys(punteros),
  ]);

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

export default function PlanViewer({
  data,
  carreraId,
  versionLabel,
  forceShowOnboarding = false,
  defaultVersionId,
  versionOptions,
}: Props) {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { idsAgrupadores } = usePlanStructure(data);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
  const onboardingStateKeyRef = useRef<string | null>(null);
  const planVisitKeyRef = useRef<string | null>(null);

  const openOnboardingDeferred = () => {
    window.requestAnimationFrame(() => {
      setIsOnboardingOpen(true);
    });
  };

  const agrupadores = data.agrupadores || [];
  const materiasPorId = useMemo(() => {
    return new Map(data.materias.map((m) => [String(m.id), m]));
  }, [data.materias]);

  const [filtros, setFiltros] = useState<FiltrosPlan>({
    ...FILTROS_INICIALES,
  });

  const canResetFiltros = filtros.codigo !== FILTROS_INICIALES.codigo
    || filtros.anio !== FILTROS_INICIALES.anio
    || filtros.cuatrimestre !== FILTROS_INICIALES.cuatrimestre
    || filtros.estado !== FILTROS_INICIALES.estado
    || filtros.orientacion !== FILTROS_INICIALES.orientacion;

  function resetFiltros() {
    setFiltros({ ...FILTROS_INICIALES });
  }

  const {
    estados,
    toggleMateria,
    deshacerMateria,
    resetMaterias,
    isHydrated,
    syncStatus,
  } =
    usePlanState(data.plan.plan_id, data.plan.version_id, data.materias, agrupadores);

  const titulo = data.plan.carrera;
  const subtitulo = `Plan ${data.plan.universidad} ${data.plan.codigo_plan} · ${versionLabel} (${data.plan.version_id})`;

  const anios = useMemo(() => {
    return Array.from(
      new Set(data.materias.map((m) => m.año).filter(Boolean))
    ) as string[];
  }, [data.materias]);

  const cuatrimestres = useMemo(() => {
    return Array.from(
      new Set(data.materias.map((m) => m.cuatrimestre).filter(Boolean))
    ) as string[];
  }, [data.materias]);

  const orientaciones = useMemo(() => {
    const vistos = new Set<string>();
    const resultado: string[] = [];

    for (const agrupador of agrupadores) {
      if (agrupador.tipo !== "optativa_grupo") continue;

      const orientacion = agrupador.orientacion;
      if (!orientacion) continue;

      const clave = normalizarTexto(orientacion);
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      resultado.push(orientacion);
    }

    return resultado;
  }, [agrupadores]);

  const materiasFiltradas = useMemo(() => {
    return filtrarMaterias({
      materias: data.materias,
      estados,
      agrupadores,
      idsAgrupadores,
      filtros,
    });
  }, [data.materias, estados, agrupadores, idsAgrupadores, filtros]);

  const agrupadorTipoPorId = useMemo(() => {
    return new Map(agrupadores.map((a) => [String(a.id), a.tipo]));
  }, [agrupadores]);

  const agrupadas = useMemo(() => {
    return agruparPorAnioYCuatrimestre(
      materiasFiltradas.filter((m) => {
        if (m.grupo_opcion) return false;

        const id = String(m.id);
        const esAgrupador = idsAgrupadores.has(id);

        if (!esAgrupador) return true;

        // Mostrar el agrupador en su cuatrimestre (Optativas/Idiomas/Seminarios)
        // como "puntero" dentro del cronograma.
        const tipo = agrupadorTipoPorId.get(id);
        return (
          tipo === "optativa_grupo" ||
          tipo === "idioma_grupo" ||
          tipo === "seminario_grupo"
        );
      })
    );
  }, [materiasFiltradas, idsAgrupadores, agrupadorTipoPorId]);

  const punterosPorAnioYCuatrimestre = useMemo(() => {
    return construirPunterosGruposPorAnioYCuatrimestre(
      materiasFiltradas,
      agrupadores,
      materiasPorId
    );
  }, [materiasFiltradas, agrupadores, materiasPorId]);

  const seccionesPorAnioYCuatrimestre = useMemo(() => {
    return combinarSeccionesPorAnioYCuatrimestre(
      agrupadas,
      punterosPorAnioYCuatrimestre
    );
  }, [agrupadas, punterosPorAnioYCuatrimestre]);

  const gruposIdiomas = agrupadores.filter((a) => a.tipo === "idioma_grupo");
  const gruposOptativas = agrupadores.filter((a) => a.tipo === "optativa_grupo");
  const gruposSeminarios = agrupadores.filter((a) => a.tipo === "seminario_grupo");

  const obtenerMateriasDeGrupo = (grupoId: string): Materia[] => {
    const grupo = agrupadores.find((a) => a.id === grupoId);
    if (!grupo) return [];

    return grupo.opciones
      .map((id) => materiasPorId.get(String(id)))
      .filter((m): m is Materia => Boolean(m))
      .filter((m) => materiasFiltradas.some((mf) => String(mf.id) === String(m.id)));
  };

  const disponibles = data.materias.filter((materia) => {
    const vm = getMateriaViewModel({
      materia,
      estados,
      todasLasMaterias: data.materias,
      agrupadores,
      idsAgrupadores,
    });

    return vm.puedeCursar && vm.estado === "no_cursada";
  }).length;

  const progreso = calcularProgresoPlan(
    data.materias,
    agrupadores,
    estados,
    disponibles
  );

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    const key = `${carreraId}::${data.plan.version_id}`;
    if (planVisitKeyRef.current === key) return;

    planVisitKeyRef.current = key;

    fetch("/api/perfil/plan-visit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        careerId: carreraId,
        planId: data.plan.plan_id,
        versionId: data.plan.version_id,
      }),
    }).catch(() => undefined);
  }, [carreraId, data.plan.plan_id, data.plan.version_id, sessionStatus]);

  useEffect(() => {
    const key = `${carreraId}::${data.plan.version_id}::${sessionStatus}::${forceShowOnboarding ? "forced" : "auto"}`;
    if (onboardingStateKeyRef.current === key) return;

    onboardingStateKeyRef.current = key;

    if (forceShowOnboarding) {
      openOnboardingDeferred();

      const params = new URLSearchParams(searchParams.toString());
      if (params.has("onboarding")) {
        params.delete("onboarding");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }

      return;
    }

    if (sessionStatus === "authenticated") {
      fetch("/api/perfil/onboarding")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { shouldAutoShowOnboarding?: boolean } | null) => {
          if (!payload) return;

          if (payload.shouldAutoShowOnboarding) {
            openOnboardingDeferred();
          }
        })
        .catch(() => undefined);

      return;
    }

    if (sessionStatus === "unauthenticated") {
      const guestState = window.localStorage.getItem("onboarding::guest::state");

      if (!guestState) {
        openOnboardingDeferred();
      }
    }
  }, [
    carreraId,
    data.plan.version_id,
    forceShowOnboarding,
    pathname,
    router,
    searchParams,
    sessionStatus,
  ]);

  async function persistOnboarding(action: "dismiss" | "complete") {
    setIsOnboardingSubmitting(true);

    if (sessionStatus === "authenticated") {
      await fetch("/api/perfil/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      }).catch(() => null);
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem("onboarding::guest::state", action);
    }

    setIsOnboardingSubmitting(false);
    setIsOnboardingOpen(false);
  }

  if (!isHydrated) return null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setIsOnboardingOpen(true)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 shadow-sm"
        >
          Ver ayuda rapida
        </button>
      </div>

      <PlanHeader
        titulo={titulo}
        subtitulo={subtitulo}
        aprobadas={progreso.aprobadas}
        cursadas={progreso.cursadas}
        disponibles={progreso.disponibles}
        total={progreso.total}
        onReset={resetMaterias}
        syncStatus={syncStatus}
        versionSelector={{
          selectedVersionId: data.plan.version_id,
          defaultVersionId,
          options: versionOptions,
        }}
      />

      <PlanFilters
        filtros={filtros}
        onChange={setFiltros}
        onReset={resetFiltros}
        canReset={canResetFiltros}
        anios={anios}
        cuatrimestres={cuatrimestres}
        orientaciones={orientaciones}
      />

      {Object.entries(seccionesPorAnioYCuatrimestre).map(([anio, cuatrimestresMap]) => (
        <AnioSection
          key={anio}
          anio={anio}
          cuatrimestres={cuatrimestresMap}
          punterosCuatrimestre={punterosPorAnioYCuatrimestre[anio] || {}}
          estados={estados}
          todasLasMaterias={data.materias}
          agrupadores={agrupadores}
          idsAgrupadores={idsAgrupadores}
          onToggle={toggleMateria}
          onUndo={deshacerMateria}
        />
      ))}

      {gruposIdiomas.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={grupo.nombre}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}

      {gruposSeminarios.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={grupo.nombre}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}

      {gruposOptativas.map((grupo) => {
        const materias = obtenerMateriasDeGrupo(grupo.id);
        if (materias.length === 0) return null;

        return (
          <GrupoMaterias
            key={grupo.id}
            titulo={`${grupo.nombre} (${grupo.id})`}
            grupoId={grupo.id}
            materias={materias}
            estados={estados}
            todasLasMaterias={data.materias}
            agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores}
            onToggle={toggleMateria}
            onUndo={deshacerMateria}
          />
        );
      })}

      <PlanOnboarding
        open={isOnboardingOpen}
        isSubmitting={isOnboardingSubmitting}
        onDismiss={() => {
          void persistOnboarding("dismiss");
        }}
        onComplete={() => {
          void persistOnboarding("complete");
        }}
      />
    </main>
  );
}