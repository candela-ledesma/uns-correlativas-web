import Link from "next/link";
import { BG_GRADIENT, HEADING_FONT } from "@/lib/tokens";
import { notFound } from "next/navigation";
import PlanViewer from "@/components/PlanViewer";
import PlanStatus from "@/components/PlanStatus";
import { getCarreraById } from "@/lib/carreras";
import {
    formatValidationIssues,
    loadPlanData,
    normalizeSearchParam,
} from "@/lib/planDataLoader";
import type { Metadata } from "next";

export async function generateMetadata({
    params,
    }: {
    params: Promise<{ carrera: string }>;
    }): Promise<Metadata> {
    const { carrera } = await params;
    const carreraData = getCarreraById(carrera);

    if (!carreraData) {
    return {
        title: "Carrera no encontrada | Planes de estudio UNS",
    };
    }

    return {
    title: `${carreraData.nombre} | Planes de estudio UNS`,
    description: `Plan de estudios y correlativas de ${carreraData.nombre}.`,
    };
}

    export default async function Page({
    params,
    searchParams,
    }: {
    params: Promise<{ carrera: string }>;
    searchParams?: Promise<{ v?: string | string[]; onboarding?: string | string[] }>;
    }) {
    const { carrera: carreraId } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const requestedVersionId = normalizeSearchParam(resolvedSearchParams.v);
    const onboardingParam = normalizeSearchParam(resolvedSearchParams.onboarding);
    const forceShowOnboarding = onboardingParam === "1" || onboardingParam === "true";
    const result = await loadPlanData(carreraId, requestedVersionId);

    if (result.status === "not-found") {
    notFound();
    }

    if (result.status === "unavailable") {
    return (
        <PlanStatus
        titulo={result.carrera.nombre}
        mensaje="Este plan (o esta versión) todavía no está cargado en la aplicación."
        />
    );
    }

    if (result.status === "invalid") {
    const mensaje =
        result.errorKind === "shape"
        ? "Los datos de este plan tienen un formato inválido y no se pueden mostrar."
        : "Los datos de este plan contienen inconsistencias internas y no se pueden mostrar de forma confiable.";

    return (
        <PlanStatus
        titulo={result.carrera.nombre}
        mensaje={mensaje}
        detallesTecnicos={formatValidationIssues(result.issues)}
        testId="plan-status-invalid"
        variant="error"
        />
    );
    }

    if (result.status === "error") {
    return (
        <PlanStatus
        titulo={result.carrera.nombre}
        mensaje="Hubo un problema inesperado al cargar este plan."
        testId="plan-status-error"
        variant="error"
        />
    );
    }

    const { data } = result;

    return (
    <main className="min-h-screen px-6 py-10" style={{ background: BG_GRADIENT, fontFamily: HEADING_FONT }}>
        <div className="mx-auto max-w-7xl">
        <div className="mb-6" data-no-print>
            <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#e2d9f3" }}
            >
            <span aria-hidden="true">←</span>
            <span>Volver al inicio</span>
            </Link>
        </div>

        <PlanViewer
            data={data}
            carreraId={carreraId}
            versionLabel={result.version.label}
            forceShowOnboarding={forceShowOnboarding}
            versionOptions={result.carrera.versions}
            defaultVersionId={result.carrera.defaultVersionId}
        />
        </div>
    </main>
    );
}