import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from .sanity_check import (
    LLMStructureError,
    PreLLMSanityError,
    check_estructura_minima,
    check_texto,
)

logger = logging.getLogger("uns.llm")

PROMPT_VERSION = "v1"
MODEL_DEFAULT = "gemini-2.0-flash"
MAX_INPUT_CHARS = 80_000

SYSTEM_PROMPT = """\
You are a data normalization engine specialized in academic curricula.

Your task is to transform unstructured academic plan content into a strictly valid JSON object that matches the PlanData schema.

## OUTPUT (STRICT)

Return ONLY a valid JSON object.
No explanations. No comments. No extra text.

The JSON MUST conform exactly to this structure:

{
  "plan": {
    "carrera": string | null,
    "duracion": string | null
  },
  "materias": [
    {
      "id": string | null,
      "nombre": string | null,
      "anio": string | null,
      "correlativas": (string | null)[]
    }
  ]
}

## CRITICAL RULES (MUST FOLLOW)

1. NEVER invent or infer data
   - If a value is not explicitly present → use null
   - Do NOT guess missing IDs, names, or correlatives

2. Correlatives
   - Extract only explicit references
   - If a correlativa is malformed or unreadable → include null
   - Do NOT attempt to fix broken codes

3. IDs
   - Must be strings
   - Preserve exact formatting from input
   - If missing or corrupted → null

4. Structure
   - Each subject must be a separate object
   - Do NOT merge subjects
   - Keep ordering as it appears in input when possible

5. Año (year)
   - Normalize values like: "Primer Año", "Segundo Año", etc.
   - If unclear → null

6. Clean text
   - Remove extra whitespace
   - Preserve semantic meaning
   - Do NOT truncate names

## ERROR HANDLING BEHAVIOR

- Missing data → null
- Ambiguous data → null
- Broken references → null
- Partial extraction is acceptable
- NEVER hallucinate values to complete the structure

## FINAL INSTRUCTION

Your response must be:
- Pure JSON
- Schema-compliant
- Deterministic
- Safe for validation

If you are unsure about any field → use null.
"""


class LLMParseError(ValueError):
    pass


def _extraer_json(texto: str) -> Any:
    # 1. JSON directo
    try:
        return json.loads(texto)
    except json.JSONDecodeError:
        pass

    # 2. Bloque ```json ... ```
    match = re.search(r"```json\s*([\s\S]+?)\s*```", texto, re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Primer { hasta último }
    start = texto.find("{")
    end = texto.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(texto[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise LLMParseError(
        f"No se pudo parsear el JSON del LLM. Respuesta recibida ({len(texto)} chars):\n{texto[:500]}"
    )


def _guardar_traza(trace_dir: Path, nombre: str, contenido: str) -> None:
    try:
        trace_dir.mkdir(parents=True, exist_ok=True)
        (trace_dir / nombre).write_text(contenido, encoding="utf-8")
    except Exception as exc:
        logger.warning("No se pudo escribir traza %s: %s", nombre, exc)


def normalizar(
    texto_limpio: str,
    *,
    model_name: str = MODEL_DEFAULT,
    trace_dir: Path | None = None,
) -> dict[str, Any]:
    api_key = os.environ.get("GOOGLE_GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "La variable de entorno GOOGLE_GEMINI_API_KEY no está configurada."
        )

    # Pre-LLM sanity check
    check_texto(texto_limpio)

    # Truncar si supera el límite
    input_text = texto_limpio
    if len(input_text) > MAX_INPUT_CHARS:
        omitidos = len(input_text) - MAX_INPUT_CHARS
        logger.warning(
            "Input truncado a %d chars (%d chars omitidos al final).",
            MAX_INPUT_CHARS,
            omitidos,
        )
        input_text = input_text[:MAX_INPUT_CHARS]

    if trace_dir:
        _guardar_traza(trace_dir, "02_texto_limpio.txt", texto_limpio)

    client = genai.Client(api_key=api_key)

    logger.info(
        "Llamando a Gemini (%s, prompt_version=%s, chars=%d)...",
        model_name,
        PROMPT_VERSION,
        len(input_text),
    )
    t0 = time.monotonic()
    response = client.models.generate_content(
        model=model_name,
        contents=input_text,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0,
            response_mime_type="application/json",
        ),
    )
    elapsed = time.monotonic() - t0
    logger.info("Respuesta recibida en %.2fs.", elapsed)

    raw_text = response.text

    if trace_dir:
        _guardar_traza(trace_dir, "03_llm_response_raw.txt", raw_text)

    try:
        plan_data = _extraer_json(raw_text)
    except LLMParseError:
        if trace_dir:
            _guardar_traza(trace_dir, "03_llm_response_raw.txt", raw_text)
        raise

    if trace_dir:
        _guardar_traza(
            trace_dir,
            "04_llm_plandata.json",
            json.dumps(plan_data, ensure_ascii=False, indent=2),
        )

    # Validación mínima post-parse
    check_estructura_minima(plan_data)

    return plan_data
