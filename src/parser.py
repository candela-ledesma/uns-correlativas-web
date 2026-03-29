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
    
    lines = texto.splitlines()
    
    # Detecta líneas de materia con formato: ID NOMBRE [HORAS] [CORRELATIVAS]
    materia_pattern = re.compile(r'^(\d+)\s+([A-ZÁÉÍÓÚ\s,]+?)(?:\s+(\d+)hs\.)?(?:\s+(\d+)\s+([A-Za-zÁÉÍÓÚ\s]+)\s+([A-Za-zÁÉÍÓÚ\s]+))?$')
    # Detecta correlativas puras: ID ESTADO ESTADO
    correlativa_pattern = re.compile(r'^(\d+)\s+([A-Za-zÁÉÍÓÚ\s]+)\s+([A-Za-zÁÉÍÓÚ\s]+)$')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Sección optativa
        if 'MATERIAS OPTATIVAS' in line.upper():
            seccion_optativa = True
            i += 1
            continue
        
        # Año
        if re.match(r'^[A-ZÑÁÉÍÓÚ\s]+AÑO$', line):
            año_actual = line.title()
            cuatrimestre_actual = None
            i += 1
            continue
        
        # Cuatrimestre
        if re.match(r'^(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto) Cuatrimestre$', line) or line.lower() == 'anual':
            cuatrimestre_actual = line.title()
            i += 1
            continue
        
        # Materia
        m = materia_pattern.match(line)
        if m:
            id_materia, nombre, horas, cor_id, cor_cursada, cor_rendir = m.groups()
            if horas is None:
                horas = ""
            
            correlativas = {}
            if cor_id:
                correlativas[cor_id] = {"cursada": cor_cursada.strip(), "rendir": cor_rendir.strip()}
            
            i += 1
            
            # Verificar correlativas en las siguientes líneas
            while i < len(lines):
                next_line = lines[i].strip()
                
                # Si es una nueva materia o sección, rompe
                if materia_pattern.match(next_line) or re.match(r'^[A-ZÑÁÉÍÓÚ\s]+AÑO$', next_line) or re.match(r'^(Primer|Segundo|Tercer|Cuarto|Quinto|Sexto) Cuatrimestre$', next_line) or next_line.lower() == 'anual':
                    break
                
                # Correlativa pura
                cor_match = correlativa_pattern.match(next_line)
                if cor_match:
                    cor_id2, cursada2, rendir2 = cor_match.groups()
                    correlativas[cor_id2] = {"cursada": cursada2.strip(), "rendir": rendir2.strip()}
                i += 1
            
            materias.append({
                "id": id_materia,
                "nombre": nombre.strip(),
                "año": año_actual,
                "cuatrimestre": cuatrimestre_actual,
                "horas": horas,
                "correlativas": correlativas,
                "optativa": seccion_optativa
            })
        else:
            i += 1
    
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
