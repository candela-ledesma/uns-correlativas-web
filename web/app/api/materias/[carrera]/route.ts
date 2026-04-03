import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ carrera: string }> }
) {
  try {
    const { carrera } = await context.params;

    const carrerasPermitidas = ["arquitectura", "filosofia"];
    if (!carrerasPermitidas.includes(carrera)) {
      console.log("Carrera no permitida en API:", carrera);
      return NextResponse.json(
        { error: "Carrera no encontrada" },
        { status: 404 }
      );
    }

    const filePath = path.join(process.cwd(), "data", `${carrera}.json`);
    console.log("API process.cwd():", process.cwd());
    console.log("API buscando archivo en:", filePath);

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