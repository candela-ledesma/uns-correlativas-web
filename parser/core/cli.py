import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Sequence

from .cleaner import limpiar_texto
from .contract_validator import format_contract_issues, validate_plan_contract
from .extractor import extraer_texto
from .parser_plan import detectar_materias_generico


def parsear_plan_pdf(pdf_path: Path) -> dict[str, Any]:
    if not pdf_path.exists() or not pdf_path.is_file():
        raise FileNotFoundError(f"No se encontro el PDF de entrada: {pdf_path}")

    texto = extraer_texto(pdf_path)
    texto_limpio = limpiar_texto(texto)
    return detectar_materias_generico(texto_limpio)


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
    from dotenv import load_dotenv
    load_dotenv()

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
        import traceback; traceback.print_exc(file=sys.stderr)
        print(f"Error: {error}", flush=True)
        return 1
    except Exception as error:  # pragma: no cover - fallback de CLI
        import traceback; traceback.print_exc(file=sys.stderr)
        print(f"Error inesperado al generar JSON: {error}", flush=True)
        return 1

    print(f"JSON generado en: {output_path}", flush=True)
    return 0
