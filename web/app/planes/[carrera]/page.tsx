import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import PlanViewer from "@/components/PlanViewer";
import PlanStatus from "@/components/PlanStatus";
import { getCarreraById } from "@/lib/carreras";

type PlanLoadResult =
    | {
        status: "ok";
        carrera: { id: string; nombre: string; jsonFile: string };
        data: any;
    }
    | {
        status: "unavailable";
        carrera: { id: string; nombre: string; jsonFile: string };
    }
    | {
        status: "invalid";
        carrera: { id: string; nombre: string; jsonFile: string };
    };

async function getPlanData(carreraId: string): Promise<PlanLoadResult | null> {
    const carrera = getCarreraById(carreraId);
    if (!carrera) return null;

    try {
    const filePath = path.join(process.cwd(), "data", carrera.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");

    return {
        status: "ok",
        carrera,
        data: JSON.parse(fileContents),
    };
    } catch (error: any) {
    if (error?.code === "ENOENT") {
        return { status: "unavailable", carrera };
    }

    console.error("Error leyendo plan:", error);
    return { status: "invalid", carrera };
    }
    }

    export default async function Page({
    params,
    }: {
    params: Promise<{ carrera: string }>;
    }) {
    const { carrera: carreraId } = await params;
    const result = await getPlanData(carreraId);

    if (!result) {
    notFound();
    }

    if (result.status === "unavailable") {
    return (
        <PlanStatus
        titulo={result.carrera.nombre}
        mensaje="Este plan todavía no está cargado en la aplicación."
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