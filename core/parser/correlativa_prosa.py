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

# Detecta requisitos cuantitativos: "mínimo/al menos N materias/asignaturas" y variantes.
# Captura patrones como: "mínimo 26 materias", "al menos 26 de las asignaturas",
# "como mínimo 26 materias aprobadas", "tener 30 asignaturas cursadas", etc.
_MINIMO_MATERIAS = re.compile(
    r'(?:como\s+)?(?:m[ií]nimo|al\s+menos|tener)(?:\s+de)?\s+(\d+)(?:.*?)(?:materias|asignaturas)',
    re.IGNORECASE,
)

_ESTADOS_VALIDOS = {"aprobada", "regular", "cursada"}


def _limpiar_descripcion(texto: str) -> str:
    return " ".join(texto.split()).strip().rstrip(".")


def inferir_requisito_especial(linea: str) -> dict | None:
    """Detecta el patrón cuantitativo 'mínimo N materias aprobadas' en una línea.

    Devuelve un dict con la estructura de requisito_especial, o None si no aplica.
    """
    m = _MINIMO_MATERIAS.search(linea)
    if not m:
        return None

    cantidad = int(m.group(1))
    descripcion = _limpiar_descripcion(linea)

    return {
        "tipo": "minimo_materias_aprobadas",
        "cantidad": cantidad,
        "descripcion": descripcion,
    }


def inferir_correlativa_en_prosa(linea: str, ids_conocidos: set) -> tuple[dict, list]:
    """Intenta extraer correlativas de una línea en prosa libre.

    Si la línea contiene el patrón cuantitativo (mínimo N materias), no infiere
    correlativas individuales — el requisito se captura como requisito_especial
    en el parser.

    Devuelve (correlativas_dict, warnings_list).
    Solo infiere si hay exactamente un ID conocido y al menos una palabra clave.
    Si hay más de un ID conocido, emite WARNING de ambigüedad y no registra.
    """
    if not _PALABRAS_CLAVE.search(linea):
        return {}, []

    # Si la línea contiene un patrón cuantitativo, no inferir correlativas —
    # será manejada como requisito_especial.
    if _MINIMO_MATERIAS.search(linea):
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
