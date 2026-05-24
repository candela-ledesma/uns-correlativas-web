import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type ExistingInfo =
  | {
      existe: true;
      materias: number;
      fechaCarga: string;
      fuente: string;
      promptVersion: string | null;
      data: unknown;
    }
  | { existe: false };

function buildInfo(planJson: string, savedAt: Date, fuente: string): ExistingInfo {
  try {
    const json = JSON.parse(planJson);
    const diffMs = Date.now() - savedAt.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const fechaLabel =
      diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
    return {
      existe: true,
      materias: (json.materias ?? []).length,
      fechaCarga: fechaLabel,
      fuente: String(json._llm_mode ?? json._saved_fuente ?? fuente),
      promptVersion: json._llm_prompt_version ?? null,
      data: json,
    };
  } catch {
    return { existe: false };
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Falta parámetro filename" }, { status: 400 });
  }

  const slug = slugFromFilename(filename);

  const [borradorParser, borradorGemini] = await Promise.all([
    prisma.plan.findUnique({ where: { slug_fuente_estado: { slug, fuente: "PARSER", estado: "BORRADOR" } } }),
    prisma.plan.findUnique({ where: { slug_fuente_estado: { slug, fuente: "GEMINI", estado: "BORRADOR" } } }),
  ]);

  const parserInfo: ExistingInfo = borradorParser
    ? buildInfo(borradorParser.planJson, borradorParser.updatedAt, "parser")
    : { existe: false };

  const geminiInfo: ExistingInfo = borradorGemini
    ? buildInfo(borradorGemini.planJson, borradorGemini.updatedAt, "gemini")
    : { existe: false };

  return NextResponse.json({ slug, parser: parserInfo, gemini: geminiInfo });
}
