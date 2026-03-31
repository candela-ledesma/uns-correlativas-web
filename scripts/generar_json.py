import json
from pathlib import Path

from core.parser.extractor import extraer_texto
from core.parser.cleaner import limpiar_texto
from core.parser.parser_plan import detectar_materias_generico

BASE_DIR = Path(__file__).resolve().parent.parent
PDF_PATH = BASE_DIR / "pdf" / "arquitectura.pdf"
OUTPUT_PATH = BASE_DIR / "data" / "arquitectura.json"


def main():
    texto = extraer_texto(PDF_PATH)
    texto_limpio = limpiar_texto(texto)
    data = detectar_materias_generico(texto_limpio)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"JSON generado en: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()