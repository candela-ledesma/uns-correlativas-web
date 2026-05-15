import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))  # funciona local y en Render

from core.parser.cli import parsear_plan_pdf

app = FastAPI(title="UNS Parser API")

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
