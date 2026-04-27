"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlanData, Materia } from "@/app/types/plan";
import PlanHeader from "@/components/plan/PlanHeader";
import PlanFilters from "@/components/plan/PlanFilters";
import OrientationSelector from "@/components/plan/OrientationSelector";
import AnioSection from "@/components/materias/AnioSection";
import GrupoMaterias from "@/components/materias/GrupoMaterias";
import PlanOnboarding from "@/components/onboarding/PlanOnboarding";
import KanbanPlan from "@/components/kanban/KanbanPlan";
import WeeklySchedule from "@/components/schedule/WeeklySchedule";
import MapaPlan from "@/components/mapa/MapaPlan";
import { usePlanState } from "@/hooks/usePlanState";
import { usePlanStructure } from "@/hooks/usePlanStructure";
import { useOnboarding } from "@/hooks/useOnboarding";
import PlanTabBar, { type PlanVista } from "@/components/plan/PlanTabBar";
import {
  agruparPorAnioYCuatrimestre,
  construirPunterosGruposPorAnioYCuatrimestre,
  combinarSeccionesPorAnioYCuatrimestre,
} from "@/lib/plan/planAgrupacion";
import { getMateriaViewModel } from "@/lib/plan/materiaViewModel";
import { calcularProgresoPlan } from "@/lib/plan/calcularProgresoPlan";
import {
  filtrarMaterias,
  normalizarTextoBusqueda,
  type FiltrosPlan,
} from "@/lib/plan/filtrarMaterias";

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
  const [vistaActiva, setVistaActiva] = useState<PlanVista>("plan");
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const planVisitKeyRef = useRef<string | null>(null);

  // Scroll to materia when coming from Mapa "Ver en Plan"
  useEffect(() => {
    if (!scrollTarget) return;
    const intento = (reintentos = 3) => {
      const el = document.getElementById(`materia-${scrollTarget}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.style.outline = "2px solid rgba(127,119,221,0.6)";
        el.style.borderRadius = "6px";
        setTimeout(() => { el.style.outline = ""; }, 1500);
        setScrollTarget(null);
      } else if (reintentos > 0) {
        setTimeout(() => intento(reintentos - 1), 80);
      }
    };
    intento();
  }, [scrollTarget]);

  const {
    isOpen:       isOnboardingOpen,
    isSubmitting: isOnboardingSubmitting,
    open:         openOnboarding,
    dismiss:      dismissOnboarding,
    complete:     completeOnboarding,
  } = useOnboarding({
    carreraId,
    versionId:           data.plan.version_id,
    forceShowOnboarding,
  });

  const agrupadores = useMemo(() => data.agrupadores ?? [], [data.agrupadores]);
  const materiasPorId = useMemo(() => {
    return new Map(data.materias.map((m) => [String(m.id), m]));
  }, [data.materias]);

  const [filtros, setFiltros] = useState<FiltrosPlan>({
    ...FILTROS_INICIALES,
  });

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

    // Extraer orientaciones de agrupadores (optativas)
    for (const agrupador of agrupadores) {
      if (agrupador.tipo !== "optativa_grupo") continue;

      const orientacion = agrupador.orientacion;
      if (!orientacion) continue;

      const clave = normalizarTextoBusqueda(orientacion);
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      resultado.push(orientacion);
    }

    // Extraer orientaciones de materias (campos orientacion/orientaciones)
    for (const materia of data.materias) {
      if (materia.orientacion) {
        const clave = normalizarTextoBusqueda(materia.orientacion);
        if (!vistos.has(clave)) {
          vistos.add(clave);
          resultado.push(materia.orientacion);
        }
      }

      if (materia.orientaciones && Array.isArray(materia.orientaciones)) {
        for (const orientacion of materia.orientaciones) {
          const clave = normalizarTextoBusqueda(orientacion);
          if (!vistos.has(clave)) {
            vistos.add(clave);
            resultado.push(orientacion);
          }
        }
      }
    }

    // Ordenar alfabéticamente
    resultado.sort();

    return resultado;
  }, [agrupadores, data.materias]);

  const orientacionCanonicaPorClave = useMemo(() => {
    const map = new Map<string, string>();

    for (const orientacion of orientaciones) {
      const clave = normalizarTextoBusqueda(orientacion);

      if (!map.has(clave)) {
        map.set(clave, orientacion);
      }
    }

    return map;
  }, [orientaciones]);

  const orientacionDesdeUrl = useMemo(() => {
    if (orientaciones.length === 0) return FILTROS_INICIALES.orientacion;

    const orientacionRaw = searchParams.get("orientacion");
    if (!orientacionRaw) return FILTROS_INICIALES.orientacion;

    const orientacion = orientacionCanonicaPorClave.get(
      normalizarTextoBusqueda(orientacionRaw)
    );

    return orientacion ?? FILTROS_INICIALES.orientacion;
  }, [orientaciones.length, orientacionCanonicaPorClave, searchParams]);

  const filtrosConOrientacion = useMemo(
    () => ({
      ...filtros,
      orientacion: orientacionDesdeUrl,
    }),
    [filtros, orientacionDesdeUrl]
  );

  const canResetFiltros = filtrosConOrientacion.codigo !== FILTROS_INICIALES.codigo
    || filtrosConOrientacion.anio !== FILTROS_INICIALES.anio
    || filtrosConOrientacion.cuatrimestre !== FILTROS_INICIALES.cuatrimestre
    || filtrosConOrientacion.estado !== FILTROS_INICIALES.estado
    || filtrosConOrientacion.orientacion !== FILTROS_INICIALES.orientacion;

  function actualizarOrientacionEnUrl(orientacion: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (orientacion === FILTROS_INICIALES.orientacion) {
      params.delete("orientacion");
    } else {
      params.set("orientacion", orientacion);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function resetFiltros() {
    setFiltros({ ...FILTROS_INICIALES });
    actualizarOrientacionEnUrl(FILTROS_INICIALES.orientacion);
  }

  const materiasFiltradas = useMemo(() => {
    return filtrarMaterias({
      materias: data.materias,
      estados,
      agrupadores,
      idsAgrupadores,
      filtros: filtrosConOrientacion,
    });
  }, [data.materias, estados, agrupadores, idsAgrupadores, filtrosConOrientacion]);

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
      }),
      filtrosConOrientacion.orientacion
    );
  }, [
    materiasFiltradas,
    idsAgrupadores,
    agrupadorTipoPorId,
    filtrosConOrientacion.orientacion,
  ]);

  const punterosPorAnioYCuatrimestre = useMemo(() => {
    return construirPunterosGruposPorAnioYCuatrimestre(
      materiasFiltradas,
      agrupadores,
      materiasPorId,
      filtrosConOrientacion.orientacion
    );
  }, [
    materiasFiltradas,
    agrupadores,
    materiasPorId,
    filtrosConOrientacion.orientacion,
  ]);

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

  if (!isHydrated) return null;

  return (
    <main className="mx-auto max-w-7xl">
      <PlanTabBar
        vistaActiva={vistaActiva}
        onChange={setVistaActiva}
        onOpenHelp={openOnboarding}
      />

      {vistaActiva === "Plan Vista" && (
        <KanbanPlan
          materias={data.materias}
          agrupadores={agrupadores}
          idsAgrupadores={idsAgrupadores}
          estados={estados}
        />
      )}

      {vistaActiva === "Planificador" && (
        <WeeklySchedule
          careerId={carreraId}
          planId={data.plan.plan_id}
          versionId={data.plan.version_id}
          materias={data.materias}
        />
      )}

      {vistaActiva === "Mapa" && (
        <MapaPlan
          materias={data.materias}
          agrupadores={agrupadores}
          idsAgrupadores={idsAgrupadores}
          estados={estados}
          onVerEnPlan={(materiaId: string) => {
            setVistaActiva("plan");
            setScrollTarget(materiaId);
          }}
        />
      )}

      {vistaActiva === "plan" && (
        <>
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

          <OrientationSelector
            orientaciones={orientaciones}
            selected={orientacionDesdeUrl}
            onSelect={actualizarOrientacionEnUrl}
          />

          <PlanFilters
            filtros={filtrosConOrientacion}
            onChange={setFiltros}
            onReset={resetFiltros}
            canReset={canResetFiltros}
            anios={anios}
            cuatrimestres={cuatrimestres}
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
        </>
      )}

      <PlanOnboarding
        open={isOnboardingOpen}
        isSubmitting={isOnboardingSubmitting}
        onDismiss={() => { void dismissOnboarding(); }}
        onComplete={() => { void completeOnboarding(); }}
      />
    </main>
  );
}