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

# Detecta "tener aprobadas todas las materias del plan" y variantes.
# También detecta la primera mitad cuando el PDF parte la frase: "aprobada todas las [Xhs.]"
_TODAS_MATERIAS = re.compile(
    r'aprobad[ao]s?\s+todas\s+las\s+(?:materias\s+del\s+plan|\d+\s*hs)',
    re.IGNORECASE,
)

# Detecta requisito de Prueba de Suficiencia de Idioma (no reemplaza correlativas).
# Patrón: "Debe rendir la Prueba de Suficiencia de Idioma"
_PRUEBA_SUFICIENCIA = re.compile(
    r'(?:Debe\s+rendir\s+la\s+)?Prueba\s+de\s+Suficiencia\s+(?:de\s+)?Idioma',
    re.IGNORECASE,
)

# Detecta "Debe tener N° año aprobado" / "tener tercer año aprobado" etc.
# También detecta la variante CGCB: "aprobado el CGCB antes de comenzar a cursar el tercer año"
_ANIO_APROBADO = re.compile(
    r'(?:'
    r'(?:debe\s+tener\s+)?'
    r'(primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o'
    r'(?:\s+(?:aprobado|completo|cursado))+'
    r'|'
    r'aprobado\s+(?:\w+\s+){0,4}antes\s+de\s+comenzar\s+a\s+cursar\s+el\s+'
    r'(primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o'
    r')',
    re.IGNORECASE,
)

# Detecta combinación "año aprobado Y primer/segundo cuatrimestre de año cursado".
# Ejemplo: "tener tercer año aprobado y primer cuatrimestre de cuarto año cursado"
# Nota: "cursado" es opcional porque el PDF puede partir la frase en dos líneas.
_ANIO_Y_CUATRIMESTRE = re.compile(
    r'(primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o'
    r'\s+aprobado'
    r'.{0,30}'
    r'(primer|segundo|1[°º]?|2[°º]?)\s+cuatrimestre'
    r'(?:\s+de\s+'
    r'(?:el\s+)?'
    r'(?:primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o)?'
    r'(?:\s+(?:aprobado|cursado))?',
    re.IGNORECASE,
)

# Detecta combinación "año N aprobado y año M cursado" (dos años distintos).
# Ejemplo: "tener tercer año aprobado y cuarto año cursado"
_ANIO_Y_ANIO_CURSADO = re.compile(
    r'(primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o'
    r'\s+aprobado'
    r'.{0,20}'
    r'(primer|segundo|tercer|cuarto|quinto|sexto|1[°º]?|2[°º]?|3[°º]?|4[°º]?|5[°º]?|6[°º]?)\s+a[ñn]o'
    r'(?:\s+(?:aprobado|cursado))?',
    re.IGNORECASE,
)

_CUATRIMESTRE_NUMERO = {"primer": 1, "1": 1, "segundo": 2, "2": 2}

_ANIO_NUMERO = {
    "primer": 1, "1": 1,
    "segundo": 2, "2": 2,
    "tercer": 3, "3": 3,
    "cuarto": 4, "4": 4,
    "quinto": 5, "5": 5,
    "sexto": 6, "6": 6,
}

_ESTADOS_VALIDOS = {"aprobada", "regular", "cursada"}


def _limpiar_descripcion(texto: str) -> str:
    texto_limpio = " ".join(texto.split()).strip().rstrip(".")
    # Eliminar IDs numéricos (4-5 dígitos) seguidos de estado
    texto_limpio = re.sub(
        r"\s+\d{4,5}\s+(?:Aprobada|Cursada|Regular)(?:\s+(?:Aprobada|Cursada|Regular))*.*$",
        "",
        texto_limpio,
    )
    # Eliminar horas y IDs alfanuméricos al final: "64hs. I0703 Aprobada Aprobada"
    texto_limpio = re.sub(
        r"\s+\d+\s*hs\.?.*$",
        "",
        texto_limpio,
        flags=re.IGNORECASE,
    )
    # Eliminar IDs alfanuméricos (ej: I0703, G1234) seguidos de estado al final
    texto_limpio = re.sub(
        r"\s+[A-Z]\d{4,5}\s+(?:Aprobada|Cursada|Regular).*$",
        "",
        texto_limpio,
        flags=re.IGNORECASE,
    )
    # Eliminar artículos/preposiciones colgantes al final
    texto_limpio = re.sub(r"\s+(?:de\s+la|del|de|el|la|los|las|un|una)\s*$", "", texto_limpio, flags=re.IGNORECASE)
    return texto_limpio.rstrip(".")


def inferir_requisito_especial(linea: str) -> list[dict] | None:
    """Detecta patrones de requisitos especiales en una línea.

    Devuelve una lista de dicts (puede ser más de uno cuando hay condiciones combinadas),
    o None si la línea no contiene ningún requisito especial reconocible.
    """
    # Verificar "todas las materias del plan aprobadas"
    if _TODAS_MATERIAS.search(linea):
        return [{"tipo": "todas_materias_aprobadas", "descripcion": _limpiar_descripcion(linea)}]

    # Prueba de Suficiencia de Idioma
    if _PRUEBA_SUFICIENCIA.search(linea):
        return [{"tipo": "prueba_idioma", "descripcion": _limpiar_descripcion(linea)}]

    # Requisitos cuantitativos
    m = _MINIMO_MATERIAS.search(linea)
    if m:
        return [{
            "tipo": "minimo_materias_aprobadas",
            "cantidad": int(m.group(1)),
            "descripcion": _limpiar_descripcion(linea),
        }]

    # Combinación: "año N aprobado y año M cursado" (dos años completos)
    # Ejemplo: "tercer año aprobado y cuarto año cursado"
    # Debe evaluarse ANTES de _ANIO_Y_CUATRIMESTRE para no confundir los dos patrones.
    ma = _ANIO_Y_ANIO_CURSADO.search(linea)
    if ma:
        raw_anio1 = ma.group(1).lower().rstrip("°º")
        raw_anio2 = ma.group(2).lower().rstrip("°º")
        numero_anio1 = _ANIO_NUMERO.get(raw_anio1)
        numero_anio2 = _ANIO_NUMERO.get(raw_anio2)
        fragmento = ma.group(0)
        partes = re.split(r'\s+y\s+', fragmento, maxsplit=1, flags=re.IGNORECASE)
        desc_anio1 = partes[0].strip().rstrip(".")
        desc_anio2 = partes[1].strip().rstrip(".") if len(partes) > 1 else fragmento.strip()
        req1: dict = {"tipo": "anio_aprobado", "descripcion": desc_anio1}
        req2: dict = {"tipo": "anio_aprobado", "descripcion": desc_anio2}
        if numero_anio1 is not None:
            req1["anio"] = numero_anio1
        if numero_anio2 is not None:
            req2["anio"] = numero_anio2
        return [req1, req2]

    # Combinación: "año N aprobado y primer/segundo cuatrimestre de año M cursado"
    # → devuelve DOS requisitos separados, cada uno con su descripción propia
    mc = _ANIO_Y_CUATRIMESTRE.search(linea)
    if mc:
        raw_anio = mc.group(1).lower().rstrip("°º")
        raw_cuatri = mc.group(2).lower().rstrip("°º")
        numero_anio = _ANIO_NUMERO.get(raw_anio)
        numero_cuatri = _CUATRIMESTRE_NUMERO.get(raw_cuatri)
        # Partir la descripción en las dos condiciones usando " y " como separador
        fragmento = mc.group(0)  # ej: "tercer año aprobado y primer cuatrimestre de cuarto año"
        partes = re.split(r'\s+y\s+', fragmento, maxsplit=1, flags=re.IGNORECASE)
        desc_anio = partes[0].strip().rstrip(".")
        desc_cuatri = partes[1].strip().rstrip(".") if len(partes) > 1 else fragmento.strip()
        req_anio: dict = {"tipo": "anio_aprobado", "descripcion": desc_anio}
        req_cuatri: dict = {"tipo": "cuatrimestre_cursado", "descripcion": desc_cuatri}
        if numero_anio is not None:
            req_anio["anio"] = numero_anio
        if numero_anio is not None:
            # cuatrimestre_cursado refiere al año SIGUIENTE al aprobado
            req_cuatri["anio"] = numero_anio + 1
        if numero_cuatri is not None:
            req_cuatri["cuatrimestre"] = numero_cuatri
        return [req_anio, req_cuatri]

    # Año aprobado simple
    m = _ANIO_APROBADO.search(linea)
    if m:
        raw = (m.group(1) or m.group(2) or "").lower().rstrip("°º")
        numero = _ANIO_NUMERO.get(raw)
        resultado: dict = {"tipo": "anio_aprobado", "descripcion": _limpiar_descripcion(linea)}
        if numero is not None:
            resultado["anio"] = numero
        return [resultado]

    return None


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
