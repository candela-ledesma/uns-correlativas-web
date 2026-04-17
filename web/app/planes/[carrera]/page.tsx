import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import PlanViewer from "@/components/PlanViewer";
import PlanStatus from "@/components/PlanStatus";
import { getCarreraById, getVersionForCarrera } from "@/lib/carreras";
import type { PlanData } from "@/app/types/plan";
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


type PlanLoadResult =
    | {
        status: "ok";
        carrera: { id: string; nombre: string };
        version: { versionId: string; label: string; jsonFile: string };
        data: PlanData;
    }
    | {
        status: "unavailable";
        carrera: { id: string; nombre: string };
    }
    | {
        status: "invalid";
        carrera: { id: string; nombre: string };
    };

function normalizeSearchParam(value: string | string[] | undefined) {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] ?? null;
    return value;
}

function ensurePlanIdentity(
    raw: unknown,
    carreraId: string,
    versionId: string
): PlanData | null {
    if (!raw || typeof raw !== "object") return null;

    const data = raw as Record<string, any>;
    if (!data.plan || typeof data.plan !== "object") return null;

    const plan = data.plan as Record<string, any>;

    if (plan.plan_id && String(plan.plan_id) !== String(carreraId)) return null;
    if (plan.version_id && String(plan.version_id) !== String(versionId)) return null;

    plan.plan_id = carreraId;
    plan.version_id = versionId;

    return data as PlanData;
}

async function getPlanData(
    carreraId: string,
    requestedVersionId: string | null
): Promise<PlanLoadResult | null> {
    const carrera = getCarreraById(carreraId);
    if (!carrera) return null;

    const version = getVersionForCarrera(carreraId, requestedVersionId);
    if (!version || version.disponible === false) {
    return {
        status: "unavailable",
        carrera: { id: carrera.id, nombre: carrera.nombre },
    };
    }

    try {
    const filePath = path.join(process.cwd(), "data", version.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");

    const parsed = JSON.parse(fileContents);
    const data = ensurePlanIdentity(parsed, carreraId, version.versionId);
    if (!data) {
        return { status: "invalid", carrera: { id: carrera.id, nombre: carrera.nombre } };
    }

    return {
        status: "ok",
        carrera: { id: carrera.id, nombre: carrera.nombre },
        version,
        data,
    };
    } catch (error: any) {
    if (error?.code === "ENOENT") {
        return { status: "unavailable", carrera: { id: carrera.id, nombre: carrera.nombre } };
    }

    console.error("Error leyendo plan:", error);
    return { status: "invalid", carrera: { id: carrera.id, nombre: carrera.nombre } };
    }
    }

    export default async function Page({
    params,
    searchParams,
    }: {
    params: Promise<{ carrera: string }>;
    searchParams?: Promise<{ v?: string | string[] }>;
    }) {
    const { carrera: carreraId } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const requestedVersionId = normalizeSearchParam(resolvedSearchParams.v);
    const result = await getPlanData(carreraId, requestedVersionId);

    if (!result) {
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
    return (
        <PlanStatus
        titulo={result.carrera.nombre}
        mensaje="Hubo un problema al cargar este plan."
        variant="error"
        />
    );
    }

    const { data } = result;

    return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
        <div className="mb-6">
            <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
            >
            <span aria-hidden="true">←</span>
            <span>Volver al inicio</span>
            </Link>
        </div>

        <PlanViewer data={data} />
        </div>
    </main>
    );
}