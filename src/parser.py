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


def detectar_materias(texto):

    materias = []
    año_actual = None
    cuatrimestre_actual = None
    seccion_optativa = False
    materia_actual = None

    lines = texto.splitlines()

    materia_pattern = re.compile(
    r'^([A-Z]?\d+)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+)')
    correlativa_pattern = re.compile(r'^([A-Z]?\d+)\s+(Aprobada|Regular|Cursada)\s+(Aprobada|Regular|Cursada)$')

    for line in lines:
        line = line.strip()

        if not line:
            continue

        # basura del pdf
        if line in ["Carga", "Horaria", "Volver"] or "Correlativas" in line:
            continue

        # detectar optativas
        if "MATERIAS OPTATIVAS" in line:
            seccion_optativa = True
            continue

        # detectar año
        if re.match(r'^[A-ZÑÁÉÍÓÚ\s]+AÑO$', line):
            año_actual = line.title()
            cuatrimestre_actual = None
            continue

        # detectar cuatrimestre
        if re.match(r'^(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto) Cuatrimestre$', line) or line.lower() == "anual":
            cuatrimestre_actual = line.title()
            continue

        # detectar correlativas
        cor = correlativa_pattern.match(line)
        if cor and materia_actual:
            cor_id, cursada, rendir = cor.groups()
            materia_actual["correlativas"][cor_id] = {
                "cursada": cursada,
                "rendir": rendir
            }
            continue

        # detectar materia
        m = materia_pattern.match(line)
        if m:
            id_materia, resto = m.groups()

            # intentar separar horas
            horas_match = re.search(r'(\d+)hs\.', resto)
            horas = horas_match.group(1) if horas_match else ""

            nombre = resto
            if horas_match:
                nombre = resto[:horas_match.start()].strip()

            año_materia = "Optativas" if seccion_optativa else año_actual

            materia_actual = {
                "id": id_materia,
                "nombre": nombre,
                "año": año_materia,
                "cuatrimestre": cuatrimestre_actual,
                "horas": horas,
                "correlativas": {},
                "optativa": seccion_optativa
            }

            materias.append(materia_actual)

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
    
    #imprimir texto crudo
    print(texto)
    
    materias = detectar_materias(texto)

    # asegurar que la carpeta existe y guardar JSON
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(materias, f, indent=2, ensure_ascii=False)
    


if __name__ == "__main__":
    main()