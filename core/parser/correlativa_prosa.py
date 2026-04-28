import re

_PALABRAS_CLAVE = re.compile(
    r'\b(cursar|aprobar|aprobada|aprobado|rendir|rendida|rendido|tener|iniciar)\b',
    re.IGNORECASE,
)

# Captura un ID numérico de 4-5 dígitos seguido opcionalmente de un estado.
_ID_CON_ESTADO = re.compile(
    r'\b(\d{4,5})\s*(Aprobada|Regular|Cursada)?\b',
    re.IGNORECASE,
)

_ESTADOS_VALIDOS = {"aprobada", "regular", "cursada"}


def inferir_correlativa_en_prosa(linea: str, ids_conocidos: set) -> tuple[dict, list]:
    """Intenta extraer correlativas de una línea en prosa libre.

    Devuelve (correlativas_dict, warnings_list).
    Solo infiere si hay exactamente un ID conocido y al menos una palabra clave.
    Si hay más de un ID conocido en la línea, emite WARNING de ambigüedad y no registra.
    """
    if not _PALABRAS_CLAVE.search(linea):
        return {}, []

    matches = _ID_CON_ESTADO.findall(linea)
    ids_en_linea = [(id_, estado.lower() if estado else None) for id_, estado in matches]
    ids_conocidos_en_linea = [(id_, estado) for id_, estado in ids_en_linea if id_ in ids_conocidos]

    if not ids_conocidos_en_linea:
        return {}, []

    if len(ids_conocidos_en_linea) > 1:
        ids_str = ", ".join(id_ for id_, _ in ids_conocidos_en_linea)
        return {}, [f"Ambigüedad: múltiples IDs conocidos en línea en prosa ({ids_str}): {linea!r}"]

    id_inferido, estado = ids_conocidos_en_linea[0]
    para_rendir = estado if estado in _ESTADOS_VALIDOS else None

    correlativas = {
        id_inferido: {
            "para_cursar": None,
            "para_rendir": para_rendir,
        }
    }
    warnings = [
        f"Correlativa inferida en prosa (ID {id_inferido}): {linea!r}"
    ]
    return correlativas, warnings
