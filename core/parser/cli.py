import argparse
import json
import logging
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
    return agrupar_materias_por_orientacion(resultado_parser)


def _uns_a_plandata(resultado_regex: dict) -> dict:
    plan = resultado_regex.get("plan") or {}
    materias_raw = resultado_regex.get("materias") or []

    materias = []
    for m in materias_raw:
        if not isinstance(m, dict):
            continue
        cors_dict = m.get("correlativas") or {}
        cors = list(cors_dict.keys()) if isinstance(cors_dict, dict) else []
        materias.append({
            "id": m.get("id"),
            "nombre": m.get("nombre"),
            "anio": m.get("año"),
            "correlativas": cors,
        })

    return {
        "plan": {
            "carrera": plan.get("carrera"),
            "duracion": plan.get("codigo_plan"),
        },
        "materias": materias,
    }


def _completar_pipeline_llm(
    texto: str,
    texto_limpio: str,
    *,
    base_json: dict | None = None,
    allow_overwrite: bool = False,
    model_name: str | None = None,
    llm_mode_label: str = "llm",
    trace_dir: Path | None = None,
) -> dict[str, Any]:
    from core.llm import llm_normalizer, sanity_check, adapter

    if trace_dir:
        _guardar_traza(trace_dir, "01_texto_extraido.txt", texto)

    plan_data = llm_normalizer.normalizar(
        texto_limpio,
        base_json=base_json,
        allow_overwrite=allow_overwrite,
        model_name=model_name or llm_normalizer.MODEL_DEFAULT,
        trace_dir=trace_dir,
    )

    sanity = sanity_check.check_plandata(plan_data)
    if not sanity.ok:
        raise ValueError("Sanity check del PlanData falló:\n" + "\n".join(sanity.errors))

    confidence = sanity_check.calcular_confidence(plan_data)
    logging.getLogger("uns.llm").info("Confidence score: %.3f", confidence)

    resultado = adapter.adaptar(plan_data, warnings=sanity.warnings)
    resultado["_llm_confidence"] = confidence
    resultado["_llm_prompt_version"] = llm_normalizer.PROMPT_VERSION
    resultado["_llm_mode"] = llm_mode_label

    if trace_dir:
        _guardar_traza(
            trace_dir,
            "07_adapter_output.json",
            json.dumps(resultado, ensure_ascii=False, indent=2),
        )

    return resultado


def parsear_plan_llm(
    pdf_path: Path,
    *,
    model_name: str | None = None,
    trace_dir: Path | None = None,
) -> dict[str, Any]:
    if not pdf_path.exists() or not pdf_path.is_file():
        raise FileNotFoundError(f"No se encontro el PDF de entrada: {pdf_path}")

    texto = extraer_texto(pdf_path)
    texto_limpio = limpiar_texto(texto)

    return _completar_pipeline_llm(
        texto,
        texto_limpio,
        model_name=model_name,
        llm_mode_label="llm",
        trace_dir=trace_dir,
    )


def parsear_plan_hybrid(
    pdf_path: Path,
    *,
    allow_overwrite: bool = False,
    model_name: str | None = None,
    trace_dir: Path | None = None,
) -> dict[str, Any]:
    if not pdf_path.exists() or not pdf_path.is_file():
        raise FileNotFoundError(f"No se encontro el PDF de entrada: {pdf_path}")

    texto = extraer_texto(pdf_path)
    texto_limpio = limpiar_texto(texto)

    resultado_regex = detectar_materias_generico(texto_limpio)
    resultado_regex = agrupar_materias_por_orientacion(resultado_regex)

    if trace_dir:
        _guardar_traza(
            trace_dir,
            "03_regex_output.json",
            json.dumps(resultado_regex, ensure_ascii=False, indent=2),
        )

    base_json = _uns_a_plandata(resultado_regex)

    return _completar_pipeline_llm(
        texto,
        texto_limpio,
        base_json=base_json,
        allow_overwrite=allow_overwrite,
        model_name=model_name,
        llm_mode_label="hybrid",
        trace_dir=trace_dir,
    )


def _guardar_traza(trace_dir: Path, nombre: str, contenido: str) -> None:
    from core.llm.llm_normalizer import _guardar_traza as _gt
    _gt(trace_dir, nombre, contenido)


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
        "--mode",
        choices=["regex", "llm", "hybrid"],
        default="regex",
        help="Motor de parseo: regex, llm (Gemini Flash) o hybrid (regex + LLM refina). Default: regex.",
    )
    parser.add_argument(
        "--allow-overwrite",
        action="store_true",
        help="Permite que el LLM corrija valores del parser regex (solo con --mode=hybrid).",
    )
    parser.add_argument(
        "--trace-dir",
        type=str,
        default=None,
        help="Directorio para guardar archivos intermedios de trazabilidad (llm/hybrid).",
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

    if args.mode in ("llm", "hybrid"):
        logging.basicConfig(
            level=logging.INFO,
            format="%(levelname)s [%(name)s] %(message)s",
        )

    try:
        trace_dir = Path(args.trace_dir).expanduser().resolve() if args.trace_dir else None

        if args.mode == "llm":
            data = parsear_plan_llm(pdf_path, trace_dir=trace_dir)
        elif args.mode == "hybrid":
            data = parsear_plan_hybrid(
                pdf_path,
                allow_overwrite=args.allow_overwrite,
                trace_dir=trace_dir,
            )
        else:
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
