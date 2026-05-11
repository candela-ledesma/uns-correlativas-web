import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type ExistingInfo = {
  existe: true;
  materias: number;
  fechaCarga: string;
  fuente: string;
  promptVersion: string | null;
  data: unknown;
} | { existe: false };

async function leerInfo(filePath: string): Promise<ExistingInfo> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(raw);
    const stat = await fs.stat(filePath);
    const diffMs = Date.now() - stat.mtimeMs;
    const diffDays = Math.floor(diffMs / 86400000);
    const fechaLabel =
      diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
    return {
      existe: true,
      materias: (json.materias ?? []).length,
      fechaCarga: fechaLabel,
      fuente: String(json._llm_mode ?? json._saved_fuente ?? "parser"),
      promptVersion: json._llm_prompt_version ?? null,
      data: json,
    };
  } catch {
    return { existe: false };
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Falta parámetro filename" }, { status: 400 });
  }

  const slug = slugFromFilename(filename);

  const [infoParser, infoGemini] = await Promise.all([
    leerInfo(path.join(DATA_DIR, `${slug}.json`)),
    leerInfo(path.join(DATA_DIR_GEMINI, `${slug}.json`)),
  ]);

  return NextResponse.json({ slug, parser: infoParser, gemini: infoGemini });
}
