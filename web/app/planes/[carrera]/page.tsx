import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import PlanViewer from "@/components/PlanViewer";

async function getMaterias(carrera: string) {
    const carrerasPermitidas = ["arquitectura", "filosofia"];

    if (!carrerasPermitidas.includes(carrera)) {
    return null;
    }

    try {
    const filePath = path.join(process.cwd(), "data", `${carrera}.json`);
    const fileContents = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContents);
    } catch (error) {
    console.error("Error leyendo plan:", error);
    return null;
    }
    }

    const nombresCarrera: Record<string, string> = {
    arquitectura: "Arquitectura",
    filosofia: "Filosofía",
    };

    export default async function Page({
    params,
    }: {
    params: Promise<{ carrera: string }>;
    }) {
    const { carrera } = await params;
    const data = await getMaterias(carrera);

    if (!data) {
    notFound();
    }

    return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
        <Link
            href="/"
            className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
            ← Volver al inicio
        </Link>

        <h1 className="mb-8 text-3xl font-bold">
            {nombresCarrera[carrera] ?? carrera}
        </h1>

        <PlanViewer data={data} />
        </div>
    </main>
    );
}