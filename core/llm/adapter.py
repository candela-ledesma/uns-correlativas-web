# DEPRECATED: pendiente de borrar (ver core/llm/)
from typing import Any

from core.parser.normalizers import normalizar_anio

_VALORES_CORRELATIVA = {"cursada", "aprobada"}


def adaptar(plan_data: dict[str, Any], *, warnings: list[str] | None = None) -> dict[str, Any]:
    plan_raw = plan_data.get("plan") or {}
    materias_raw = plan_data.get("materias") or []
    agrupadores_raw = plan_data.get("agrupadores") or []

    plan = {
        "carrera": _str(plan_raw.get("carrera")),
        "universidad": _str(plan_raw.get("universidad")),
        "codigo_plan": _str(plan_raw.get("codigo_plan")),
    }

    materias = []
    for item in materias_raw:
        if not isinstance(item, dict):
            continue

        req_esp = _adaptar_requisito_especial(item.get("requisito_especial"))
        materia: dict[str, Any] = {
            "id": _str(item.get("id")),
            "nombre": _str(item.get("nombre")),
            "año": _normalizar_anio_llm(item.get("año")),
            "cuatrimestre": _str(item.get("cuatrimestre")),
            "horas": _str(item.get("horas")) or "",
            "tipo": item.get("tipo") or "materia",
            "categoria": item.get("categoria") or "normal",
            "grupo_opcion": _str(item.get("grupo_opcion")),
            "subtipo": _str(item.get("subtipo")),
            "correlativas": _adaptar_correlativas(item.get("correlativas")),
        }
        if req_esp is not None:
            materia["requisito_especial"] = req_esp

        materias.append(materia)

    agrupadores = []
    for agr in agrupadores_raw:
        if not isinstance(agr, dict):
            continue
        agrupadores.append({
            "id": _str(agr.get("id")),
            "nombre": _str(agr.get("nombre")),
            "tipo": _str(agr.get("tipo")),
            "opciones": [o for o in (agr.get("opciones") or []) if isinstance(o, str) and o.strip()],
            "año": _normalizar_anio_llm(agr.get("año")),
            "cuatrimestre": _str(agr.get("cuatrimestre")),
        })

    agrupadores_por_id = {a["id"]: a for a in agrupadores if a.get("id")}

    # Heredar año/cuatrimestre del agrupador para optativas sin ubicación
    for materia in materias:
        if materia["año"] is None and materia.get("grupo_opcion"):
            agr = agrupadores_por_id.get(materia["grupo_opcion"])
            if agr:
                materia["año"] = agr.get("año")
                materia["cuatrimestre"] = agr.get("cuatrimestre")

    resultado: dict[str, Any] = {
        "plan": plan,
        "materias": materias,
        "agrupadores": agrupadores,
    }

    if warnings:
        resultado["_warnings"] = warnings

    return resultado


def _str(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return value.strip() or None


def _normalizar_anio_llm(anio_raw: Any) -> str | None:
    if not isinstance(anio_raw, str):
        return None
    anio = anio_raw.strip()
    if not anio:
        return None
    return normalizar_anio(anio)


def _adaptar_correlativas(correlativas_raw: Any) -> dict[str, Any]:
    if not isinstance(correlativas_raw, dict):
        return {}

    resultado: dict[str, Any] = {}
    for id_correlativa, requisitos in correlativas_raw.items():
        if not isinstance(id_correlativa, str):
            continue
        id_limpio = id_correlativa.strip()
        if not id_limpio:
            continue
        if isinstance(requisitos, dict):
            para_cursar = requisitos.get("para_cursar")
            para_rendir = requisitos.get("para_rendir")
            resultado[id_limpio] = {
                "para_cursar": para_cursar if para_cursar in _VALORES_CORRELATIVA else None,
                "para_rendir": para_rendir if para_rendir in _VALORES_CORRELATIVA else None,
            }
        else:
            resultado[id_limpio] = {"para_cursar": None, "para_rendir": None}

    return resultado


def _adaptar_requisito_especial(req_raw: Any) -> dict[str, Any] | None:
    if not isinstance(req_raw, dict):
        return None
    tipo = req_raw.get("tipo")
    if not isinstance(tipo, str) or not tipo.strip():
        return None
    req: dict[str, Any] = {"tipo": tipo.strip()}
    if req_raw.get("cantidad") is not None:
        req["cantidad"] = req_raw["cantidad"]
    descripcion = _str(req_raw.get("descripcion"))
    if descripcion:
        req["descripcion"] = descripcion
    return req
