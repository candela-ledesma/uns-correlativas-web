# DEPRECATED: pendiente de borrar — el parseo ahora corre dentro de la API (/api/admin/planes/parsear-local/)
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from core.parser.cli import main as parser_cli_main


def main():
    if len(sys.argv) < 3:
        print("Uso: python -m scripts.generar_json <pdf_entrada> <json_salida>")
        sys.exit(1)

    pdf_rel = sys.argv[1]
    json_rel = sys.argv[2]

    pdf_path = BASE_DIR / pdf_rel
    output_path = BASE_DIR / json_rel

    exit_code = parser_cli_main([
        str(pdf_path),
        str(output_path),
    ])
    if exit_code != 0:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()