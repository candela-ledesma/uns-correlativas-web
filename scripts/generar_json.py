import sys
from pathlib import Path
import json

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from core.parser.extractor import extraer_texto
from core.parser.cleaner import limpiar_texto
from core.parser.parser_plan import detectar_materias_generico


def main():
    if len(sys.argv) < 3:
        print("Uso: python -m scripts.generar_json <pdf_entrada> <json_salida>")
        sys.exit(1)

    pdf_rel = sys.argv[1]
    json_rel = sys.argv[2]

    pdf_path = BASE_DIR / pdf_rel
    output_path = BASE_DIR / json_rel

    texto = extraer_texto(pdf_path)
    texto_limpio = limpiar_texto(texto)
    data = detectar_materias_generico(texto_limpio)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"JSON generado en: {output_path}")


if __name__ == "__main__":
    main()