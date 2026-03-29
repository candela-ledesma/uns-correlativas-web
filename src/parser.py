import pdfplumber
import re
from pathlib import Path
import json

BASE_DIR = Path(__file__).resolve().parent.parent
PDF_PATH = BASE_DIR / "pdf" / "arquitectura.pdf"
OUTPUT_PATH = BASE_DIR / "data" / "arquitectura.json"


def extraer_texto(pdf_path):
    texto = ""

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            contenido = page.extract_text()
            if contenido:
                texto += contenido + "\n"

    return texto



import re

def detectar_materias(texto):
    materias = []
    materia_actual = None
    año_actual = None
    cuatrimestre_actual = None

    # Patrón para detectar materias
    patron_materia = r"^(\d{4})\s+(.+?)\s+\d+\s*hs"
    # Patrón para detectar correlativas
    patron_corr = r"(\d{4})\s+(Cursada|Aprobada)\s+(Aprobada)"
    
    # Patrón para detectar año
    patron_año = r"^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO) AÑO"
    # Patrón para detectar cuatrimestre (incluye 'Anual')
    patron_cuatri = r"^(Primer|Segundo|Anual) Cuatrimestre"

    for linea in texto.split("\n"):
        linea = linea.strip()
        if not linea:
            continue

        # Detectar año
        match_año = re.match(patron_año, linea, re.IGNORECASE)
        if match_año:
            año_actual = match_año.group(1).capitalize()
            cuatrimestre_actual = "Anual"  # Por defecto, hasta que cambie
            continue

        # Detectar cuatrimestre
        match_cuatri = re.match(patron_cuatri, linea, re.IGNORECASE)
        if match_cuatri:
            cuatrimestre_actual = match_cuatri.group(1).capitalize()
            continue

        # Detectar materia
        match = re.search(patron_materia, linea)
        if match:
            codigo = int(match.group(1))
            nombre = match.group(2).strip()
            materia_actual = {
                "id": codigo,
                "nombre": nombre,
                "año": año_actual,
                "cuatrimestre": cuatrimestre_actual,
                "correlativas": {}
            }
            materias.append(materia_actual)
            continue

        # Detectar correlativas
        if materia_actual:
            matches = re.findall(patron_corr, linea)
            for cod, estado_cursar, estado_rendir in matches:
                cod = int(cod)
                materia_actual["correlativas"][cod] = {
                    "para_cursar": estado_cursar.lower(),
                    "para_rendir": estado_rendir.lower()
                }

    return materias

def detectar_correlativas(linea):

    correlativas = []

    patron = r"(\d{4})\s+(Cursada|Final)\s+Aprobada"

    matches = re.findall(patron, linea)

    for codigo, tipo in matches:

        correlativas.append({
            "materia": int(codigo),
            "tipo": tipo.lower()
        })

    return correlativas


def main():
    texto = extraer_texto(PDF_PATH)
    
    materias = detectar_materias(texto)

    # asegurar que la carpeta existe y guardar JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(materias, f, indent=2, ensure_ascii=False)
    


if __name__ == "__main__":
    main()
