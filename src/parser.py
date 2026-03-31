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
    año_actual = None
    cuatrimestre_actual = None
    seccion_optativa = False
    materia_actual = None

    lines = texto.splitlines()

    # Materia: codigo + nombre
    materia_pattern = re.compile(r'^([A-Z]?\d+)\s+(.+)$')

    # Correlativa en línea propia: CODIGO ESTADO ESTADO
    correlativa_pattern = re.compile(
        r'^([A-Z]?\d+)\s+(Aprobada|Regular|Cursada)\s+(Aprobada|Regular|Cursada)$',
        re.IGNORECASE
    )

    # Busca correlativa pegada al final de una línea de materia:
    # ej: "ESTRUCTURAS IV 2405 Aprobada Aprobada"
    correlativa_inline_pattern = re.compile(
        r'^(.*?)\s+([A-Z]?\d+)\s+(Aprobada|Regular|Cursada)\s+(Aprobada|Regular|Cursada)$',
        re.IGNORECASE
    )

    basura_exacta = {
        "Carga", "Horaria", "Volver", "Materia",
        "Para cursar", "Para rendir"
    }

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            continue

        # basura del pdf
        if line in basura_exacta:
            continue

        if "Correlativas" in line:
            continue

        if line in {"U N S", "NIVERSIDAD ACIONAL DEL UR"}:
            continue

        # detectar inicio sección optativas
        if "MATERIAS OPTATIVAS" in line.upper():
            seccion_optativa = True
            materia_actual = None
            continue

        # detectar año
        if re.match(r'^[A-ZÑÁÉÍÓÚ\s]+AÑO$', line):
            año_actual = line.title()
            cuatrimestre_actual = None
            materia_actual = None
            continue

        # detectar cuatrimestre
        if re.match(r'^(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto) Cuatrimestre$', line, re.IGNORECASE) or line.lower() == "anual":
            cuatrimestre_actual = line.title()
            materia_actual = None
            continue

        # detectar correlativa en línea sola
        cor = correlativa_pattern.match(line)
        if cor and materia_actual:
            cor_id, cursada, rendir = cor.groups()
            materia_actual["correlativas"][cor_id] = {
                "cursada": cursada.title(),
                "rendir": rendir.title()
            }
            continue

        # detectar materia u opción optativa
        m = materia_pattern.match(line)
        if not m:
            continue

        id_materia, resto = m.groups()
        resto = resto.strip()

        # si después del código no hay nada útil, no es materia
        if len(resto) < 3:
            continue

        # si lo que viene después del código son solo estados, no es materia
        if re.match(r'^(Aprobada|Regular|Cursada)(\s+(Aprobada|Regular|Cursada))*$', resto, re.IGNORECASE):
            continue

        # extraer horas si existen
        horas_match = re.search(r'(\d+)\s*hs\.', resto, re.IGNORECASE)
        horas = horas_match.group(1) if horas_match else ""

        nombre_y_despues = resto
        if horas_match:
            nombre_y_despues = resto[:horas_match.start()].strip()

        # limpiar estados pegados
        nombre_y_despues = re.sub(r'\b(Aprobada|Regular|Cursada)\b', '', nombre_y_despues, flags=re.IGNORECASE)
        nombre_y_despues = re.sub(r'\s+', ' ', nombre_y_despues).strip()

        # si quedó vacío, no crear materia
        if not nombre_y_despues:
            continue

        # caso: correlativa pegada al final de la línea de materia
        # ejemplo:
        # "ESTRUCTURAS IV 2405 Aprobada Aprobada"
        inline = correlativa_inline_pattern.match(nombre_y_despues)
        correlativa_inline = None

        if inline:
            nombre_limpio, cor_id, cursada, rendir = inline.groups()
            nombre_limpio = nombre_limpio.strip()

            # evitar tomar como nombre algo vacío
            if nombre_limpio:
                nombre = nombre_limpio
                correlativa_inline = {
                    "id": cor_id,
                    "cursada": cursada.title(),
                    "rendir": rendir.title()
                }
            else:
                continue
        else:
            nombre = nombre_y_despues

        # quitar códigos colgando al final del nombre
        # ejemplo: "GESTION LABORAL Y AMBIENTAL 2405"
        nombre = re.sub(r'\s+[A-Z]?\d+$', '', nombre).strip()

        # si quedó vacío después de limpiar, no crear
        if not nombre:
            continue

        # si estamos en sección optativa y la materia actual es contenedora,
        # las siguientes líneas son opciones y no materias nuevas
        if (
            seccion_optativa
            and materia_actual
            and materia_actual.get("optativa")
            and "OPTATIVA" in materia_actual["nombre"].upper()
            and "opciones" in materia_actual
        ):
            materia_actual["opciones"].append({
                "id": id_materia,
                "nombre": nombre,
                "horas": horas
            })
            continue

        año_materia = "Optativas" if seccion_optativa else año_actual

        nueva_materia = {
            "id": id_materia,
            "nombre": nombre,
            "año": año_materia,
            "cuatrimestre": cuatrimestre_actual,
            "horas": horas,
            "correlativas": {},
            "optativa": seccion_optativa
        }

        # si es contenedora de optativas
        if seccion_optativa and "OPTATIVA" in nombre.upper():
            nueva_materia["opciones"] = []

        # agregar correlativa inline si la tenía
        if correlativa_inline:
            nueva_materia["correlativas"][correlativa_inline["id"]] = {
                "cursada": correlativa_inline["cursada"],
                "rendir": correlativa_inline["rendir"]
            }

        materias.append(nueva_materia)
        materia_actual = nueva_materia

    # eliminar duplicados exactos por id+año+cuatrimestre+nombre
    vistos = set()
    materias_limpias = []

    for mat in materias:
        clave = (mat["id"], mat["nombre"], mat["año"], mat["cuatrimestre"])
        if clave not in vistos:
            vistos.add(clave)
            materias_limpias.append(mat)

    return materias_limpias

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