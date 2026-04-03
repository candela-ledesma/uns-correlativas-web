import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getCarreraById } from "@/lib/carreras";

export async function GET(
  _req: Request,
  context: { params: Promise<{ carrera: string }> }
) {
  try {
    const { carrera: carreraId } = await context.params;
    const carrera = getCarreraById(carreraId);

    if (!carrera) {
      return NextResponse.json(
        { error: "Carrera no encontrada" },
        { status: 404 }
      );
    }

    const filePath = path.join(process.cwd(), "data", carrera.jsonFile);
    const fileContents = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(fileContents);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en API:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las materias" },
      { status: 500 }
    );
  }
}