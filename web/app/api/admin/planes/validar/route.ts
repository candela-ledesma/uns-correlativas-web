import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_LOCAL   = path.join(process.cwd(), "data", "local");
const DATA_DIR_GEMINI  = path.join(process.cwd(), "data", "gemini");
const PROJECT_ROOT     = path.join(process.cwd(), "..");
const PYTHON           = path.join(PROJECT_ROOT, ".venv", "bin", "python3");

function runScript(refPath: string, candPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, ["-m", "scripts.comparar_json", refPath, candPath], {
      cwd: PROJECT_ROOT,
    });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => { out += d.toString(); });
    proc.stderr.on("data", (d) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0 && !out) reject(new Error(err || `exit code ${code}`));
      else resolve(out || err);
    });
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await req.json() as { slug: string };
  if (!slug) return NextResponse.json({ error: "Falta slug" }, { status: 400 });

  const refPath  = path.join(DATA_DIR_LOCAL,  `${slug}.json`);
  const candPath = path.join(DATA_DIR_GEMINI, `${slug}_pendiente.json`);

  const [refExists, candExists] = await Promise.all([
    fs.access(refPath).then(() => true).catch(() => false),
    fs.access(candPath).then(() => true).catch(() => false),
  ]);

  if (!candExists) {
    return NextResponse.json({ error: "No se encontró el JSON pendiente" }, { status: 404 });
  }

  if (!refExists) {
    return NextResponse.json({ sinGroundTruth: true });
  }

  try {
    const output = await runScript(refPath, candPath);
    return NextResponse.json({ output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
