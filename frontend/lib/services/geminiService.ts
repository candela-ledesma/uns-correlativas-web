import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";
import { DEFAULT_SYSTEM_PROMPT, GENERIC_SYSTEM_PROMPT, PROMPT_VERSION } from "@/lib/ai/prompt";
import { prisma } from "@/lib/db/prisma";

export async function readAdminConfig(): Promise<{ systemPrompt?: string; genericPrompt?: string }> {
  try {
    const config = await prisma.adminConfig.findUnique({ where: { id: "singleton" } });
    if (!config) return {};
    return {
      systemPrompt: config.systemPrompt ?? undefined,
      genericPrompt: config.genericPrompt ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function getActivePrompt(): Promise<{
  system: string;
  generic: string;
  version: string;
}> {
  const config = await readAdminConfig();
  return {
    system: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    generic: config.genericPrompt ?? GENERIC_SYSTEM_PROMPT,
    version: PROMPT_VERSION,
  };
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

export type GeminiParseResult = {
  data: Record<string, unknown>;
  model: string;
  usage: { promptTokens: number | null; candidateTokens: number | null; totalTokens: number | null } | null;
};

export async function parsePdfWithGemini(
  fileBytes: ArrayBuffer,
  model: string = DEFAULT_GEMINI_MODEL,
): Promise<GeminiParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI service configuration error: PDF processing temporarily unavailable");
  }

  const pdfBase64 = Buffer.from(fileBytes).toString("base64");
  const { system: systemInstruction } = await getActivePrompt();

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }] }],
    config: { systemInstruction, temperature: 0 },
  });

  const rawText = response.text ?? "";
  const data = extraerJSON(rawText) as Record<string, unknown>;
  data._llm_prompt_version = PROMPT_VERSION;
  data._llm_mode = "llm";

  const usage = response.usageMetadata ?? null;
  return {
    data,
    model,
    usage: usage ? {
      promptTokens: usage.promptTokenCount ?? null,
      candidateTokens: usage.candidatesTokenCount ?? null,
      totalTokens: usage.totalTokenCount ?? null,
    } : null,
  };
}
