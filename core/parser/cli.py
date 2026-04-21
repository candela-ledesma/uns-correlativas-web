import argparse
import json
from pathlib import Path
from typing import Any, Sequence

from .cleaner import limpiar_texto
from .contract_validator import format_contract_issues, validate_plan_contract
from .extractor import extraer_texto
from .parser_plan import detectar_materias_generico
from .orientation_grouper import agrupar_materias_por_orientacion


def parsear_plan_pdf(pdf_path: Path) -> dict[str, Any]:
    if not pdf_path.exists() or not pdf_path.is_file():
        raise FileNotFoundError(f"No se encontro el PDF de entrada: {pdf_path}")

    texto = extraer_texto(pdf_path)
    texto_limpio = limpiar_texto(texto)
    resultado_parser = detectar_materias_generico(texto_limpio)
    
    # Agrupar por orientación
    return agrupar_materias_por_orientacion(resultado_parser)



def guardar_json_plan(
    data: dict[str, Any],
    output_path: Path,
    *,
    indent: int = 2,
    ensure_ascii: bool = False,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(data, output_file, ensure_ascii=ensure_ascii, indent=indent)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Genera JSON estructurado de plan/correlativas a partir de un PDF.",
    )
    parser.add_argument(
        "pdf_entrada",
        help="Ruta al PDF de entrada.",
    )
    parser.add_argument(
        "json_salida",
        help="Ruta del JSON de salida.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Indentacion del JSON de salida (default: 2).",
    )
    parser.add_argument(
        "--ensure-ascii",
        action="store_true",
        help="Escapa caracteres no ASCII en el JSON de salida.",
    )
    parser.add_argument(
        "--skip-contract-validation",
        action="store_true",
        help="Omite la validacion de contrato parser->JSON (no recomendado).",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    pdf_path = Path(args.pdf_entrada).expanduser().resolve()
    output_path = Path(args.json_salida).expanduser().resolve()

    try:
        data = parsear_plan_pdf(pdf_path)

        if not args.skip_contract_validation:
            validation = validate_plan_contract(data)

            if not validation.is_valid:
                print("Error: el resultado del parser no cumple el contrato de datos.")
                print(format_contract_issues(validation.errors))
                return 1

            if validation.warnings:
                print(
                    f"Aviso: validacion con {len(validation.warnings)} warning(s)."
                )

        guardar_json_plan(
            data,
            output_path,
            indent=args.indent,
            ensure_ascii=args.ensure_ascii,
        )
    except FileNotFoundError as error:
        print(f"Error: {error}")
        return 1
    except Exception as error:  # pragma: no cover - fallback de CLI
        print(f"Error inesperado al generar JSON: {error}")
        return 1

    print(f"JSON generado en: {output_path}")
    return 0
