import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SIZE_MB = 20;
const PROMPT_VERSION = "v17";

const SYSTEM_PROMPT = `You are a deterministic data extraction engine for academic curricula.

You receive a PDF of an academic study plan directly. Read the document visually — tables, headings, columns, and layout — and extract all information into a strictly valid JSON object following the PlanData schema below.

## OUTPUT (STRICT)

Return ONLY a valid JSON object. No explanations, no comments, no markdown, no extra text.

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
      "id": "string",
      "nombre": "string | null",
      "año": "string | null",
      "cuatrimestre": "string | null",
      "horas": "string | null",
      "tipo": "materia | null",
      "categoria": "normal | optativa | null",
      "grupo_opcion": "string (ID of agrupador) | null",
      "subtipo": "string | null",
      "correlativas": {
        "<prerequisite_id>": {
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
      "opciones": ["string (IDs of member subjects)"],
      "año": "string | null",
      "cuatrimestre": "string | null"
    }
  ]
}
\`\`\`

---

## FIELD DETAILS

**plan**
- \`carrera\`: degree name as written in the document (e.g. "Abogacía", "Ingeniería Civil")
- \`universidad\`: institution name (e.g. "Universidad Nacional del Sur")
- \`codigo_plan\`: plan code or version as written (e.g. "Plan 2020 - Versión 2")

**materias[].correlativas**
- Each key is the ID of a prerequisite subject or group
- \`para_cursar\`: requirement to enroll → "cursada" or "aprobada" or null
- \`para_rendir\`: requirement to sit the final exam → "cursada" or "aprobada" or null
- Read the correlativas table visually: the FIRST column (or first listed value) is \`para_cursar\`, the SECOND is \`para_rendir\`
- If only one requirement is listed, use it for both fields
- No prerequisites → empty object \`{}\`

**materias[].horas**
- Extract only the numeric value as a string (e.g. "64", "96")
- Strip any unit suffix ("hs", "horas", etc.)
- If no hours are listed for a subject → use \`""\`
- Be careful: a numeric value next to a subject name may be a correlativa ID, not hours — check the column context visually

**materias[].año**
- Normalize to: "Primer Año", "Segundo Año", "Tercer Año", "Cuarto Año", "Quinto Año", "Sexto Año"
- Infer from the section heading that visually groups the subject in the PDF

**materias[].cuatrimestre**
- Normalize to: "Primer Cuatrimestre" or "Segundo Cuatrimestre"
- If the subject spans the full year or no cuatrimestre heading is visible → null

**materias[].categoria**
- \`"normal"\` for mandatory subjects
- \`"optativa"\` for elective subjects that belong to an agrupador

---

## SPECIAL PATTERNS (CRITICAL)

### Pattern A — Elective group as prerequisite (agrupador_requisito)

A group ID (starting with G, e.g. G0857) can appear in TWO visual positions in the PDF:

**POSITION A**: Visible inside the year/semester table, listed as a correlativa of a mandatory subject.
→ Generate BOTH:
  1. An entry in \`materias[]\` with that G#### ID, \`tipo: "agrupador_requisito"\`, same \`año\`/\`cuatrimestre\` as the containing section
  2. An entry in \`agrupadores[]\`

**POSITION B**: Visible as a section header in the "MATERIAS OPTATIVAS" block, introducing a list of elective subjects.
→ Generate ONLY an entry in \`agrupadores[]\`. Do NOT add it to \`materias[]\`.

A single G#### can appear in BOTH positions (as a correlativa AND as an optativas section header).
In that case generate BOTH the \`materias[]\` entry AND the \`agrupadores[]\` entry.

### Pattern B — Language requirement (idioma_grupo)

When a language group ID (starting with the LETTER I, e.g. I0022, I0023, I0024) is visible in the PDF, generate THREE entries:
1. \`agrupadores[]\`: \`tipo: "idioma_grupo"\`, list all language exam IDs in \`opciones\`
2. \`materias[]\`: entry with the same I#### ID, \`tipo: "materia"\`, \`subtipo: "idioma"\`
3. \`materias[]\`: one entry per language exam listed under the group, \`categoria: "optativa"\`, \`subtipo: "idioma"\`

**CRITICAL — I#### ID recognition:**
These IDs start with the LETTER I (uppercase i), NOT the digit 1. They look like: I0022, I0023, I0024.
- NEVER write them as 10022, 10023, 10024 — those are wrong and do not exist.
- When an I#### appears as a correlativa of another subject, keep the ID exactly as written: \`"I0022"\`, \`"I0023"\`, etc.
- When I#### appears as a correlativa with only one requirement column filled, assign it to the correct field:
  - If only \`para_rendir\` is required → \`{"para_cursar": null, "para_rendir": "aprobada"}\`
  - If only \`para_cursar\` is required → \`{"para_cursar": "aprobada", "para_rendir": null}\`
  - Do NOT swap these fields.

### Elective subjects (MATERIAS OPTATIVAS section)

- Each elective subject gets \`categoria: "optativa"\` and \`grupo_opcion: <agrupador_id>\`
- They do not have an explicit year heading — assign them the \`año\`/\`cuatrimestre\` of their agrupador
- List all their IDs in \`agrupadores[].opciones\`

### año/cuatrimestre for agrupadores

The \`año\` and \`cuatrimestre\` of an agrupador in POSITION A MUST match the year/semester section heading that visually contains it in the PDF layout.

---

---

## RULES (ALL MANDATORY)

1. NEVER invent or infer data not explicitly visible in the PDF → use null
2. Extract ALL subjects: mandatory, elective, language. Do not skip any section.
3. Extract only correlativas explicitly shown in the document. Do NOT infer from prose descriptions.
4. All IDs must be strings, exact format as printed in the PDF.
5. Each regular subject (numeric ID) appears exactly ONCE in \`materias[]\`.
6. G#### and I#### IDs appear in BOTH \`materias[]\` and \`agrupadores[]\` when in POSITION A.
7. Do NOT duplicate any entry.
8. List ALL member subject IDs in \`agrupadores[].opciones\`.
9. When correlativa rows appear at the top of a page before any new subject, assign them to the last subject of the previous page.

## VALIDATION

- \`materias\` must be non-empty if any subjects are detected
- \`correlativas\` must always be an object (never null, never array)
- \`agrupadores\` must always be an array (empty \`[]\` if none found)

## FINAL INSTRUCTION

Your response MUST be strict JSON, schema-compliant and safe for automatic validation. If unsure about a value → use null.`;

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
