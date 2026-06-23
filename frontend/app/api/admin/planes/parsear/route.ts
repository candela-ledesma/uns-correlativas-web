import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/auth/authz";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";
import { PROMPT_VERSION } from "@/lib/ai/prompt";
import { getActivePrompt, parsePdfWithGemini } from "@/lib/services/geminiService";
import { MAX_UPLOAD_SIZE_MB } from "@/lib/config/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const PARSER_API_URL = process.env.PARSER_API_URL;

export async function GET() {
  const session = await requireAdminOrModerator();
  if (session instanceof NextResponse) return session;
  const { system: systemPrompt, generic: genericPrompt, version } = await getActivePrompt();
  return NextResponse.json({ systemPrompt, genericPrompt, version });
}

export async function POST(request: Request) {
  const session = await requireAdminOrModerator();
  if (session instanceof NextResponse) return session;

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
  if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo supera los ${MAX_UPLOAD_SIZE_MB} MB` }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
  }
  const magic = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (magic[0] !== 0x25 || magic[1] !== 0x50 || magic[2] !== 0x44 || magic[3] !== 0x46 || magic[4] !== 0x2D) {
    return NextResponse.json({ error: "El archivo no es un PDF válido" }, { status: 400 });
  }

  const model = (formData.get("model") as string) || DEFAULT_GEMINI_MODEL;

  // En prod (PARSER_API_URL definida) delegar a Render — sin límite de tiempo de Vercel
  if (PARSER_API_URL) {
    const { system: systemPrompt } = await getActivePrompt();
    const fd = new FormData();
    fd.append("file", new Blob([await file.arrayBuffer()], { type: "application/pdf" }), file.name);
    fd.append("model", model);
    fd.append("system_prompt", systemPrompt);

    try {
      const res = await fetch(`${PARSER_API_URL}/parse-gemini`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        return NextResponse.json({ type: "error", message: `Parser API error ${res.status}: ${err}` }, { status: 502 });
      }
      const result = await res.json() as Record<string, unknown>;
      if (result.data && typeof result.data === "object") {
        const data = result.data as Record<string, unknown>;
        data._llm_prompt_version = PROMPT_VERSION;
        data._llm_mode = "llm";
      }
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ type: "error", message: msg }, { status: 500 });
    }
  }

  // Local: llamar a Gemini directo desde Next.js
  try {
    const bytes = await file.arrayBuffer();
    const { data, usage } = await parsePdfWithGemini(bytes, model);
    return NextResponse.json({ type: "done", data, model, usage });
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {}
    return NextResponse.json({ type: "error", message: msg }, { status: 500 });
  }
}
