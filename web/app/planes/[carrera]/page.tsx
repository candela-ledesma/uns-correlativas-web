import Link from "next/link";
import { notFound } from "next/navigation";
import { promises as fs } from "fs";
import path from "path";
import PlanViewer from "@/components/PlanViewer";
import { getCarreraById } from "@/lib/carreras";

async function getPlanData(carreraId: string) {
  const carrera = getCarreraById(carreraId);
  if (!carrera) return null;

  try {
    const filePath = path.join(process.cwd(), "data", carrera.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");
    return {
      carrera,
      data: JSON.parse(fileContents),
    };
  } catch (error) {
    console.error("Error leyendo plan:", error);
    return null;
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

  const { carrera, data } = result;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          ← Volver al inicio
        </Link>

        <h1 className="mb-8 text-3xl font-bold">{carrera.nombre}</h1>

        <PlanViewer data={data} />
      </div>
    </main>
  );
}