# DEPRECATED: pendiente de borrar (ver core/llm/)
import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SanityResult:
    ok: bool
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class PreLLMSanityError(ValueError):
    pass


class LLMStructureError(ValueError):
    pass


_PALABRAS_CLAVE = re.compile(
    r"AÑO|CUATRIMESTRE|Aprobada|Regular|Cursada|CARRERA|PLAN",
    re.IGNORECASE,
)
_PATRON_ID = re.compile(r"\d{4,}")


def check_texto(texto: str) -> None:
    errors: list[str] = []

    if not isinstance(texto, str) or len(texto.strip()) < 200:
        errors.append(
            f"Texto demasiado corto o vacío ({len(texto) if isinstance(texto, str) else 0} chars). "
            "El PDF puede estar mal extraído."
        )
        raise PreLLMSanityError("\n".join(errors))

    if not _PATRON_ID.search(texto):
        errors.append("No se encontró ningún ID de materia (4+ dígitos) en el texto.")

    if not _PALABRAS_CLAVE.search(texto):
        errors.append(
            "No se encontraron palabras clave académicas (AÑO, CUATRIMESTRE, Aprobada, etc.)."
        )

    if errors:
        raise PreLLMSanityError("\n".join(errors))


def check_estructura_minima(data: Any) -> None:
    if not isinstance(data, dict):
        raise LLMStructureError(
            f"El JSON del LLM no es un objeto (tipo recibido: {type(data).__name__})."
        )
    if not isinstance(data.get("plan"), dict):
        raise LLMStructureError(
            "El JSON del LLM no contiene 'plan' como objeto."
        )
    materias = data.get("materias")
    if not isinstance(materias, list) or len(materias) == 0:
        raise LLMStructureError(
            "El JSON del LLM no contiene 'materias' como lista no vacía."
        )


def check_plandata(plan_data: dict) -> SanityResult:
    warnings: list[str] = []
    errors: list[str] = []

    materias = plan_data.get("materias", [])
    total = len(materias)
    if total == 0:
        errors.append("PlanData no tiene materias.")
        return SanityResult(ok=False, errors=errors)

    ids_nulos = 0
    nombres_nulos = 0

    for i, materia in enumerate(materias):
        if not isinstance(materia, dict):
            warnings.append(f"materias[{i}] no es un objeto, se ignorará.")
            continue

        tiene_id = isinstance(materia.get("id"), str) and materia["id"].strip()
        tiene_nombre = isinstance(materia.get("nombre"), str) and materia["nombre"].strip()

        if not tiene_id:
            ids_nulos += 1
        if not tiene_nombre:
            nombres_nulos += 1

        if not tiene_id and not tiene_nombre:
            warnings.append(f"materias[{i}] no tiene 'id' ni 'nombre' válidos.")

        correlativas = materia.get("correlativas")
        if correlativas is not None and not isinstance(correlativas, dict):
            errors.append(
                f"materias[{i}].correlativas es {type(correlativas).__name__}, se esperaba dict. "
                "El LLM devolvió formato incorrecto."
            )

    ratio_ids_nulos = ids_nulos / total
    ratio_nombres_nulos = nombres_nulos / total

    if ratio_ids_nulos > 0.30:
        errors.append(
            f"{ids_nulos}/{total} materias ({ratio_ids_nulos:.0%}) no tienen ID. "
            "Señal de extracción fallida."
        )
    if ratio_nombres_nulos > 0.50:
        errors.append(
            f"{nombres_nulos}/{total} materias ({ratio_nombres_nulos:.0%}) no tienen nombre. "
            "Señal de extracción fallida."
        )

    return SanityResult(ok=len(errors) == 0, warnings=warnings, errors=errors)


def calcular_confidence(plan_data: dict) -> float:
    materias = plan_data.get("materias", [])
    total = len(materias)
    if total == 0:
        return 0.0

    con_id = sum(
        1 for m in materias
        if isinstance(m, dict) and isinstance(m.get("id"), str) and m["id"].strip()
    )
    con_nombre = sum(
        1 for m in materias
        if isinstance(m, dict) and isinstance(m.get("nombre"), str) and m["nombre"].strip()
    )
    tiene_carrera = 1.0 if plan_data.get("plan", {}).get("carrera") else 0.0

    score = (con_id / total) * 0.5 + (con_nombre / total) * 0.3 + tiene_carrera * 0.2
    return round(score, 3)
