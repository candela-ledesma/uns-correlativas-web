import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "arquitectura.json");
    const fileContent = await readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: "No se pudo leer el archivo JSON" },
      { status: 500 }
    );
  }
}