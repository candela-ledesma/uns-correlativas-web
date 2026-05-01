from typing import Any

from core.parser.normalizers import normalizar_anio


def adaptar(plan_data: dict[str, Any], *, warnings: list[str] | None = None) -> dict[str, Any]:
    plan_raw = plan_data.get("plan") or {}
    materias_raw = plan_data.get("materias") or []

    plan = {
        "carrera": plan_raw.get("carrera") or None,
        "universidad": None,
        "codigo_plan": plan_raw.get("duracion") or None,
    }

    materias = []
    for item in materias_raw:
        if not isinstance(item, dict):
            continue

        materia_id = item.get("id")
        if isinstance(materia_id, str):
            materia_id = materia_id.strip() or None

        nombre = item.get("nombre")
        if isinstance(nombre, str):
            nombre = nombre.strip() or None

        anio_raw = item.get("anio")
        anio = _normalizar_anio_llm(anio_raw)

        correlativas_raw = item.get("correlativas")
        correlativas = _adaptar_correlativas(correlativas_raw)

        materias.append({
            "id": materia_id,
            "nombre": nombre,
            "año": anio,
            "cuatrimestre": None,
            "horas": "",
            "tipo": "materia",
            "categoria": "normal",
            "grupo_opcion": None,
            "subtipo": None,
            "correlativas": correlativas,
        })

    resultado: dict[str, Any] = {
        "plan": plan,
        "materias": materias,
        "agrupadores": [],
    }

    if warnings:
        resultado["_warnings"] = warnings

    return resultado


def _normalizar_anio_llm(anio_raw: Any) -> str | None:
    if not isinstance(anio_raw, str):
        return None
    anio = anio_raw.strip()
    if not anio:
        return None
    return normalizar_anio(anio)


def _adaptar_correlativas(correlativas_raw: Any) -> dict[str, Any]:
    if not isinstance(correlativas_raw, list):
        return {}

    resultado: dict[str, Any] = {}
    for id_correlativa in correlativas_raw:
        if not isinstance(id_correlativa, str):
            continue
        id_limpio = id_correlativa.strip()
        if not id_limpio:
            continue
        resultado[id_limpio] = {"para_cursar": None, "para_rendir": None}

    return resultado
