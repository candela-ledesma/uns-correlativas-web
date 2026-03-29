from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pathlib import Path
import json

BASE = Path(__file__).resolve().parent.parent
DATA_FILE = BASE / "data" / "arquitectura.json"
WEB_DIR = BASE / "web"

app = FastAPI()

# montar carpeta web en / (opcional) o en /static
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")

@app.get("/")
def index():
    return FileResponse(WEB_DIR / "index.html")

@app.get("/api/materias")
def api_materias():
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        data = []
    return JSONResponse(content=data)