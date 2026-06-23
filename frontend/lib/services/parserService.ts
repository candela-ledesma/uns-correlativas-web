import { spawn } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

function getProjectRoot(): string {
  return path.join(process.cwd(), "..");
}

function getPython(): string {
  return path.join(getProjectRoot(), ".venv", "bin", "python3");
}

const PARSER_API_URL = process.env.PARSER_API_URL;

// ── Subprocess helpers ────────────────────────────────────────────────────────

function spawnScript(args: string[]): Promise<string> {
  const projectRoot = getProjectRoot();
  const python = getPython();
  return new Promise((resolve, reject) => {
    const proc = spawn(python, args, { cwd: projectRoot });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code !== 0 && !out) reject(new Error(err.trim() || `exit code ${code}`));
      else resolve(out || err);
    });
    proc.on("error", (e) => reject(new Error(`No se pudo ejecutar el parser: ${e.message}`)));
  });
}

function runParserLocal(pdfPath: string, outPath: string): Promise<void> {
  const projectRoot = getProjectRoot();
  const python = getPython();
  return new Promise((resolve, reject) => {
    const proc = spawn(python, ["-m", "core.parser", pdfPath, outPath], {
      cwd: projectRoot,
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

async function runParserRemote(fileBytes: ArrayBuffer, filename: string): Promise<Record<string, unknown>> {
  if (!PARSER_API_URL) throw new Error("PARSER_API_URL no configurada");
  const formData = new FormData();
  formData.append("file", new Blob([fileBytes], { type: "application/pdf" }), filename);
  const res = await fetch(`${PARSER_API_URL}/parse`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Parser API error ${res.status}: ${err}`);
  }
  const body = await res.json() as { type: string; data: Record<string, unknown> };
  return body.data;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type ParseProgress = (type: string, payload?: Record<string, unknown>) => void;

/**
 * Parsea un PDF con el parser local (Python subprocess) o el API remota.
 * Llama a `onProgress` para streaming SSE; si no se provee, el resultado es síncrono.
 */
export async function parsePdfLocal(
  fileBytes: ArrayBuffer,
  filename: string,
  onProgress: ParseProgress,
): Promise<Record<string, unknown>> {
  if (PARSER_API_URL) {
    onProgress("progress", { step: "parseando", message: "Ejecutando parser…" });
    const data = await runParserRemote(fileBytes, filename);
    onProgress("progress", { step: "leyendo", message: "Procesando resultado…" });
    return data;
  }

  const ts = Date.now();
  const pdfPath = path.join(tmpdir(), `uns_parser_${ts}.pdf`);
  const outPath = path.join(tmpdir(), `uns_parser_${ts}.json`);

  try {
    onProgress("progress", { step: "guardando", message: "Preparando el PDF…" });
    await writeFile(pdfPath, Buffer.from(fileBytes));

    onProgress("progress", { step: "parseando", message: "Ejecutando parser local…" });
    await runParserLocal(pdfPath, outPath);

    onProgress("progress", { step: "leyendo", message: "Procesando resultado…" });
    const raw = await readFile(outPath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } finally {
    await unlink(pdfPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

/**
 * Compara un JSON candidato contra el ground truth local usando el script Python.
 * Devuelve `{ sinGroundTruth: true }` si no existe referencia, o `{ output }` con el diff.
 */
export async function compareAgainstGroundTruth(
  refPath: string,
  candPath: string,
): Promise<string> {
  return spawnScript(["-m", "scripts.comparar_json", refPath, candPath]);
}
