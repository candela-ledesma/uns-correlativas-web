import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { CARRERAS } from "@/lib/data/carreras";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_LOCAL  = path.join(process.cwd(), "data", "local");
const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const planes = await Promise.all(
    CARRERAS.map(async (carrera) => {
      const version = carrera.versions.find(v => v.versionId === carrera.defaultVersionId) ?? carrera.versions[0];
      if (!version) return null;

      const localPath  = path.join(DATA_DIR_LOCAL,  version.jsonFile);
      const geminiPath = path.join(DATA_DIR_GEMINI, version.jsonFile);

      const [localStat, geminiStat] = await Promise.all([
        fs.stat(localPath).catch(() => null),
        fs.stat(geminiPath).catch(() => null),
      ]);

      let materias: number | null = null;
      let fuente: string | null = null;
      let savedAt: string | null = null;

      const srcPath = localStat ? localPath : geminiStat ? geminiPath : null;
      if (srcPath) {
        try {
          const raw = await fs.readFile(srcPath, "utf-8");
          const data = JSON.parse(raw);
          materias = (data.materias ?? []).length;
          fuente = data._saved_fuente ?? (localStat ? "parser" : "gemini");
          savedAt = data._saved_at ?? (localStat ? localStat.mtime.toISOString() : geminiStat?.mtime.toISOString() ?? null);
        } catch { /* skip */ }
      }

      return {
        id: carrera.id,
        nombre: carrera.nombre,
        departamento: carrera.departamento ?? null,
        disponible: carrera.disponible ?? true,
        jsonFile: version.jsonFile,
        tieneLocal:  !!localStat,
        tieneGemini: !!geminiStat,
        materias,
        fuente,
        savedAt,
      };
    })
  );

  return NextResponse.json({ planes: planes.filter(Boolean) });
}
