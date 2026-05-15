import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

import sys
_root = str(Path(__file__).parent.parent)
sys.path.insert(0, _root)
print(f"[parser_api] sys.path root: {_root}", flush=True)

try:
    from core.parser.cli import parsear_plan_pdf
    print("[parser_api] core.parser.cli importado OK", flush=True)
except Exception as _e:
    print(f"[parser_api] ERROR importando core: {_e}", flush=True)
    raise

app = FastAPI(title="UNS Parser API")
print("[parser_api] FastAPI app creada, rutas registradas", flush=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))

API_SECRET = os.environ.get("PARSER_API_SECRET")


def _check_auth(authorization: str | None) -> None:
    if not API_SECRET:
        return
    if authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="No autorizado")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/parse")
async def parse_pdf(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    _check_auth(authorization)

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Se requiere un archivo PDF")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
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

    return JSONResponse(content=data)
