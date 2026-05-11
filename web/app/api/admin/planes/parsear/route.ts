import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SIZE_MB = 20;
const PROMPT_VERSION = "v15";

const SYSTEM_PROMPT = `You are a deterministic data normalization engine for academic curricula.

Your task is to transform raw, unstructured academic plan content into a strictly valid JSON object that follows the PlanData schema.

---

## INPUT

You will receive:

1. RAW_TEXT:
   Unstructured text extracted from a PDF (may contain noise, broken formatting, OCR issues).

---

## OUTPUT (STRICT)

Return ONLY a valid JSON object.

* No explanations
* No comments
* No markdown
* No extra text

---

## TARGET SCHEMA (PlanData)

\`\`\`json
{
  "plan": {
    "carrera": "string | null",
    "universidad": "string | null",
    "codigo_plan": "string | null"
  },
  "materias": [
    {
      "id": "string | null",
      "nombre": "string | null",
      "año": "string | null",
      "cuatrimestre": "string | null",
      "horas": "string | null",
      "tipo": "materia | null",
      "categoria": "normal | optativa | null",
      "grupo_opcion": "string (ID of agrupador) | null",
      "subtipo": "string | null",
      "correlativas": {
        "<id_materia>": {
          "para_cursar": "cursada | aprobada | null",
          "para_rendir": "cursada | aprobada | null"
        }
      }
    }
  ],
  "agrupadores": [
    {
      "id": "string",
      "nombre": "string | null",
      "tipo": "optativa_grupo | idioma_grupo | null",
      "opciones": ["string (IDs of materias)"],
      "año": "string | null",
      "cuatrimestre": "string | null"
    }
  ]
}
\`\`\`

### Field details

**plan**
- \`carrera\`: name of the degree (e.g. "Abogacia", "Ingeniería en Sistemas")
- \`universidad\`: university name (e.g. "Universidad Nacional del Sur")
- \`codigo_plan\`: plan code/version (e.g. "Plan 2020 - Versión 2")

**materias[].correlativas**
- Object keyed by the prerequisite subject ID (string)
- \`para_cursar\`: requirement to enroll — "cursada" (passed) or "aprobada" (approved/final exam passed)
- \`para_rendir\`: requirement to take the final exam — same values
- If a requirement does not apply → null
- If no prerequisites → empty object {}

**RAW_TEXT correlativas format (CRITICAL):**
Each correlativa line looks like: \`<id> <Cursada|Aprobada> <Cursada|Aprobada>\`
The FIRST value is \`para_cursar\`, the SECOND is \`para_rendir\`.
Example: \`9001 Cursada Aprobada\` → \`{"9001": {"para_cursar": "cursada", "para_rendir": "aprobada"}}\`
If only one value appears, use it for both fields.

**materias[].categoria**
- \`"normal"\` for mandatory subjects
- \`"optativa"\` for elective subjects that belong to an agrupador

**Elective group nodes (CRITICAL — agrupador_requisito pattern):**
In the RAW_TEXT, a group ID (starting with G) can appear in two distinct positions:

POSITION A — Inside the year/semester plan, at the end of a subject's correlativas block:
  → Generate BOTH an entry in \`materias\` (tipo: "agrupador_requisito") AND in \`agrupadores\`.

POSITION B — As a section header introducing a list of elective subjects (under "MATERIAS OPTATIVAS"):
  → Generate ONLY an entry in \`agrupadores\`. Do NOT add it to \`materias\`.

**CRITICAL — año/cuatrimestre inference for agrupadores:**
The \`año\` and \`cuatrimestre\` of an agrupador MUST be inferred from the year/semester heading
that immediately precedes it in the RAW_TEXT.

Elective subjects listed in the "MATERIAS OPTATIVAS" section do NOT have an explicit year.
Assign them the \`año\`/\`cuatrimestre\` of their agrupador (referenced by their \`grupo_opcion\` field).

**Language requirement (CRITICAL — idioma_grupo pattern):**
When a language group (ID starting with I, e.g. "I0024") appears in the text, generate THREE entries:
1. An entry in \`agrupadores\` with \`tipo: "idioma_grupo"\`.
2. An entry in \`materias\` with the same ID, \`tipo: "materia"\`, \`subtipo: "idioma"\`.
3. Each exam listed under the language group in \`materias\` with \`categoria: "optativa"\`, \`subtipo: "idioma"\`.

---

## CRITICAL RULES (MUST FOLLOW)

1. NEVER invent or infer data — if not explicitly present → use null

2. Extract ALL subjects including electives. Process the entire "MATERIAS OPTATIVAS" section.

3. Extract only explicit correlativas from RAW_TEXT. Do NOT infer from free-text descriptions.

4. IDs must be strings, exact format.

4b. \`horas\`: extract only the numeric value. Strip unit suffix. If no hours listed → use \`""\`.
    Some subjects appear without hours: \`20103 EPIDEMIOLOGIA CLINICA 8170 Aprobada Aprobada\`
    — here "8170" is the first correlativa ID, not hours. Set horas: "".

5. año: normalize to "Primer Año", "Segundo Año", "Tercer Año", "Cuarto Año", "Quinto Año", etc.

6. cuatrimestre: normalize to "Primer Cuatrimestre" or "Segundo Cuatrimestre". If annual → null.

7. Each subject must be a separate object. Do NOT merge subjects.

8. For each agrupador, list ALL its member subject IDs in \`opciones\`.

9. Set \`categoria: "optativa"\` and \`grupo_opcion: <agrupador_id>\` for every elective subject.

10. NEVER duplicate a regular subject. Each numeric subject ID appears exactly ONCE in \`materias\`.

11. G#### and I#### IDs appear in BOTH \`materias[]\` and \`agrupadores[]\` when in POSITION A.

## VALIDATION CONSTRAINTS

* "materias" must be non-empty if any subjects are detected
* "correlativas" must always be an object (never null or array)
* "agrupadores" must always be an array (empty [] if none detected)

## FINAL INSTRUCTION

Your response MUST be strict JSON, schema-compliant and safe for automatic validation. If unsure → use null.`;

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
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
                { text: "OPTIONAL_BASE_JSON:\nnone\n\nALLOW_OVERWRITE:\nfalse" },
              ],
            },
          ],
          config: { systemInstruction: SYSTEM_PROMPT, temperature: 0 },
        });

        const rawText = response.text ?? "";
        const data = extraerJSON(rawText) as Record<string, unknown>;
        data._llm_confidence = 1.0;
        data._llm_prompt_version = PROMPT_VERSION;
        data._llm_mode = "llm";

        send("done", { data });
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
