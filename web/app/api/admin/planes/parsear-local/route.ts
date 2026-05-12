import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SIZE_MB = 20;
const PROJECT_ROOT = path.join(process.cwd(), "..");
const PYTHON = path.join(PROJECT_ROOT, ".venv", "bin", "python3");

function sseEvent(type: string, payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

function runParser(pdfPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, ["-m", "core.parser", pdfPath, outPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    const stderr: string[] = [];
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.join("").trim() || `El parser salió con código ${code}`));
    });

    proc.on("error", (err) => reject(new Error(`No se pudo ejecutar el parser: ${err.message}`)));
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Error leyendo el formulario: ${msg}` }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo supera los ${MAX_SIZE_MB} MB` }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: Record<string, unknown> = {}) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));
      };

      const ts = Date.now();
      const pdfPath = path.join(tmpdir(), `uns_parser_${ts}.pdf`);
      const outPath = path.join(tmpdir(), `uns_parser_${ts}.json`);

      try {
        send("progress", { step: "guardando", message: "Preparando el PDF…" });
        const bytes = await file.arrayBuffer();
        await writeFile(pdfPath, Buffer.from(bytes));

        send("progress", { step: "parseando", message: "Ejecutando parser local…" });
        await runParser(pdfPath, outPath);

        send("progress", { step: "leyendo", message: "Procesando resultado…" });
        const raw = await readFile(outPath, "utf-8");
        const data = JSON.parse(raw) as Record<string, unknown>;

        send("done", { data });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send("error", { message: msg });
      } finally {
        await unlink(pdfPath).catch(() => {});
        await unlink(outPath).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
