import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authz";
import path from "path";
import fs from "fs/promises";
import { compareAgainstGroundTruth } from "@/lib/services/parserService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_LOCAL  = path.join(process.cwd(), "data", "local");
const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { slug } = await req.json() as { slug: string };
  if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }

  const refPath  = path.join(DATA_DIR_LOCAL,  `${slug}.json`);
  const candPath = path.join(DATA_DIR_GEMINI, `${slug}_pendiente.json`);

  const [refExists, candExists] = await Promise.all([
    fs.access(refPath).then(() => true).catch(() => false),
    fs.access(candPath).then(() => true).catch(() => false),
  ]);

  if (!candExists) return NextResponse.json({ error: "No se encontró el JSON pendiente" }, { status: 404 });
  if (!refExists) return NextResponse.json({ sinGroundTruth: true });

  try {
    const output = await compareAgainstGroundTruth(refPath, candPath);
    return NextResponse.json({ output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
