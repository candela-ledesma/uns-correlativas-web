import base64
import json
import os
import re
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import sys
_root = str(Path(__file__).parent.parent)
sys.path.insert(0, _root)

try:
    from core.parser.cli import parsear_plan_pdf
except Exception as _e:
    print(f"[parser_api] ERROR importando core: {_e}", flush=True)
    raise

app = FastAPI(title="UNS Parser API")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://uns-correlativas.vercel.app")
MAX_SIZE_BYTES = 20 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/parse")
async def parse_pdf(
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Se requiere un archivo PDF")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 20 MB")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = Path(tmp.name)

    try:
        data = parsear_plan_pdf(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return JSONResponse(content={"type": "done", "data": data})


def _extraer_json(raw: str) -> dict:
    text = raw.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    md = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if md:
        try:
            return json.loads(md.group(1))
        except json.JSONDecodeError:
            pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    preview = raw[:300] if len(raw) > 300 else raw
    raise ValueError(f"No se pudo extraer JSON de la respuesta del modelo.\nRespuesta: {preview}")


@app.post("/parse-gemini")
async def parse_gemini(
    file: UploadFile = File(...),
    model: str = Form(default="gemini-2.5-flash"),
    system_prompt: str = Form(default=""),
):

    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY no configurada en el servidor")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Se requiere un archivo PDF")

    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 20 MB")

    try:
        from google import genai
        from google.genai import types as genai_types
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"google-genai no instalado: {e}")

    pdf_b64 = base64.b64encode(contents).decode("utf-8")
    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        response = client.models.generate_content(
            model=model,
            contents=[
                genai_types.Content(
                    role="user",
                    parts=[genai_types.Part(inline_data=genai_types.Blob(mime_type="application/pdf", data=pdf_b64))],
                )
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt or None,
                temperature=0,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error llamando a Gemini: {e}")

    raw_text = response.text or ""
    try:
        data = _extraer_json(raw_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    usage = response.usage_metadata
    return JSONResponse(content={
        "type": "done",
        "data": data,
        "model": model,
        "usage": {
            "promptTokens": getattr(usage, "prompt_token_count", None),
            "candidateTokens": getattr(usage, "candidates_token_count", None),
            "totalTokens": getattr(usage, "total_token_count", None),
        } if usage else None,
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("parser_api.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
