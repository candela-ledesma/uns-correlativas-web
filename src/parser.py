import pdfplumber
import re
from pathlib import Path
import json
from core.correlativas import simular_aprobar

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



def detectar_materias(texto):

    materias = []
    materia_actual = None

    patron_materia = r"^(\d{4})\s+(.+?)\s+\d+\s*hs"
    patron_corr = r"(\d{4})\s+(Cursada|Aprobada)\s+(Aprobada)"

    for linea in texto.split("\n"):

        linea = linea.strip()

        if not linea:
            continue

        match = re.search(patron_materia, linea)

        if match:

            codigo = int(match.group(1))
            nombre = match.group(2).strip()

            materia_actual = {
                "id": codigo,
                "nombre": nombre,
                "correlativas": {}
            }

            materias.append(materia_actual)

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
