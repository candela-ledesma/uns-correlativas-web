import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/auth/authz";
import { prisma } from "@/lib/db/prisma";
import { toSlug } from "@/lib/utils/slug";
import { diffDaysLabel, parseMateriaCount } from "@/lib/db/planRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    return {
      existe: true,
      materias: parseMateriaCount(planJson),
      fechaCarga: diffDaysLabel(savedAt),
      fuente: String(json._llm_mode ?? json._saved_fuente ?? fuente),
      promptVersion: json._llm_prompt_version ?? null,
      data: json,
    };
  } catch {
    return { existe: false };
  }
}

export async function GET(request: Request) {
  const session = await requireAdminOrModerator();
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Falta parámetro filename" }, { status: 400 });
  }

  const slug = toSlug(filename.replace(/\.pdf$/i, ""));

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
