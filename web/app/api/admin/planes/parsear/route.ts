import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";
import { DEFAULT_SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/ai/prompt";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SIZE_MB = 20;
const CONFIG_PATH = path.join(process.cwd(), "data", "admin-config.json");

async function readAdminConfig(): Promise<{ systemPrompt?: string }> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
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

function sseEvent(type: string, payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: Record<string, unknown> = {}) => {
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));
      };

      try {
        send("progress", { step: "leyendo", message: "Leyendo el PDF…" });
        const bytes = await file.arrayBuffer();
        const pdfBase64 = Buffer.from(bytes).toString("base64");

        send("progress", { step: "enviando", message: "Enviando a Gemini…" });
        const ai = new GoogleGenAI({ apiKey });

        send("progress", { step: "generando", message: "Generando JSON…" });
        const adminConfig = await readAdminConfig();
        const systemInstruction = adminConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
              ],
            },
          ],
          config: { systemInstruction, temperature: 0 },
        });

        const rawText = response.text ?? "";
        const data = extraerJSON(rawText) as Record<string, unknown>;
        data._llm_confidence = 1.0;
        data._llm_prompt_version = PROMPT_VERSION;
        data._llm_mode = "llm";

        const usage = response.usageMetadata ?? null;
        send("done", {
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
        send("error", { message: msg });
      } finally {
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
