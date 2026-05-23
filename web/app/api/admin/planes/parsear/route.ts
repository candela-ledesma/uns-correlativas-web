import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";
import { DEFAULT_SYSTEM_PROMPT, GENERIC_SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/ai/prompt";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const adminConfig = await readAdminConfig();
  const systemPrompt = adminConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const genericPrompt = adminConfig.genericPrompt ?? GENERIC_SYSTEM_PROMPT;
  return NextResponse.json({ systemPrompt, genericPrompt, version: PROMPT_VERSION });
}

const MAX_SIZE_MB = 20;

async function readAdminConfig(): Promise<{ systemPrompt?: string; genericPrompt?: string }> {
  try {
    const config = await prisma.adminConfig.findUnique({ where: { id: "singleton" } });
    if (!config) return {};
    return {
      systemPrompt: config.systemPrompt,
      genericPrompt: config.genericPrompt ?? undefined,
    };
  } catch {
    return {};
  }
}

function slugFromData(data: Record<string, unknown>): string | null {
  const carrera = (data.plan as Record<string, unknown> | undefined)?.carrera;
  if (typeof carrera !== "string" || !carrera) return null;
  return carrera
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function extraerJSON(raw: string): unknown {
  const direct = raw.trim();
  const errors: string[] = [];

  try { return JSON.parse(direct); } catch (e) { errors.push(`directo: ${(e as Error).message}`); }

  const mdMatch = direct.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    try { return JSON.parse(mdMatch[1]); } catch (e) { errors.push(`markdown block: ${(e as Error).message}`); }
  }

  const braceStart = direct.indexOf("{");
  const braceEnd = direct.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd !== -1) {
    try { return JSON.parse(direct.slice(braceStart, braceEnd + 1)); } catch (e) { errors.push(`brace extract: ${(e as Error).message}`); }
  }

  const preview = raw.length > 500 ? raw.slice(0, 500) + "…" : raw;
  throw new Error(
    `No se pudo extraer JSON de la respuesta del modelo.\n\nErrores de parseo:\n${errors.join("\n")}\n\nRespuesta recibida:\n${preview || "(vacía)"}`
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.ADMIN && session.user.role !== Role.MODERATOR)) {
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

  const model = (formData.get("model") as string) || DEFAULT_GEMINI_MODEL;

  const parserApiUrl = process.env.PARSER_API_URL;

  // En prod (PARSER_API_URL definida) delegar a Render — sin límite de tiempo de Vercel
  if (parserApiUrl) {
    const adminConfig = await readAdminConfig();
    const systemPrompt = adminConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const fd = new FormData();
    fd.append("file", new Blob([await file.arrayBuffer()], { type: "application/pdf" }), file.name);
    fd.append("model", model);
    fd.append("system_prompt", systemPrompt);

    try {
      const res = await fetch(`${parserApiUrl}/parse-gemini`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.text().catch(() => res.statusText);
        return NextResponse.json({ type: "error", message: `Parser API error ${res.status}: ${err}` }, { status: 502 });
      }
      const result = await res.json() as Record<string, unknown>;
      // Aplicar metadata de versión
      if (result.data && typeof result.data === "object") {
        const data = result.data as Record<string, unknown>;
        data._llm_prompt_version = PROMPT_VERSION;
        data._llm_mode = "llm";
        // Autoguardar borrador Gemini en BD
        const slug = slugFromData(data);
        if (slug) {
          await prisma.planBorrador.upsert({
            where: { slug_fuente: { slug, fuente: "gemini" } },
            update: { planJson: JSON.stringify(data), updatedAt: new Date() },
            create: { slug, fuente: "gemini", planJson: JSON.stringify(data) },
          }).catch(() => {});
        }
      }
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ type: "error", message: msg }, { status: 500 });
    }
  }

  // Local: llamar a Gemini directo desde Next.js
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service configuration error: PDF processing temporarily unavailable" },
      { status: 500 }
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const pdfBase64 = Buffer.from(bytes).toString("base64");

    const ai = new GoogleGenAI({ apiKey });
    const adminConfig = await readAdminConfig();
    const systemInstruction = adminConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }],
        },
      ],
      config: { systemInstruction, temperature: 0 },
    });

    const rawText = response.text ?? "";
    const data = extraerJSON(rawText) as Record<string, unknown>;
    data._llm_prompt_version = PROMPT_VERSION;
    data._llm_mode = "llm";

    // Autoguardar borrador Gemini en BD
    const slug = slugFromData(data);
    if (slug) {
      await prisma.planBorrador.upsert({
        where: { slug_fuente: { slug, fuente: "gemini" } },
        update: { planJson: JSON.stringify(data), updatedAt: new Date() },
        create: { slug, fuente: "gemini", planJson: JSON.stringify(data) },
      }).catch(() => {});
    }

    const usage = response.usageMetadata ?? null;
    return NextResponse.json({
      type: "done",
      data,
      model,
      usage: usage ? {
        promptTokens: usage.promptTokenCount ?? null,
        candidateTokens: usage.candidatesTokenCount ?? null,
        totalTokens: usage.totalTokenCount ?? null,
      } : null,
    });
  } catch (err) {
    let msg = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {}
    return NextResponse.json({ type: "error", message: msg }, { status: 500 });
  }
}
