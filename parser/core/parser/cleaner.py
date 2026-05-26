import re
from .patterns import (
    PATRON_ANIO,
    PATRON_CUATRIMESTRE,
    PATRON_SECCION_OPTATIVAS,
    PATRON_SECCION_IDIOMAS,
    PATRON_SECCION_SEMINARIOS,
    PATRON_SECCION_ORIENTACION,
    PATRON_MATERIA,
    PATRON_CORRELATIVA_SOLO,
    PATRON_CORRELATIVA_UN_ESTADO_SOLO,
)

BASURA_EXACTA = {
    "U N S",
    "NIVERSIDAD ACIONAL DEL UR",
    "Carga",
    "Horaria",
    "Materia",
    "Correlativas",
    "Para cursar",
    "Para rendir",
    "Ir a Moodle UNS",
    "Materia Correlativas Para cursar Para rendir",
    "Optativa Correlativas Para cursar Para rendir",
    "Carga Horaria",
    "Volver",
}

BASURA_PREFIJOS = (
    "Visite el Departamento",
    "Universidad Nacional del Sur",
    "Avda.",
)

# Sufijos de encabezado de tabla que pueden aparecer pegados al nombre de una materia
# cuando el limpiador fusiona líneas. Se eliminan del final del nombre.
_SUFIJOS_ENCABEZADO = (
    " Optativa Correlativas Para cursar Para rendir",
    " Materia Correlativas Para cursar Para rendir",
    " Correlativas Para cursar Para rendir",
    " Para cursar Para rendir",
    " Carga Horaria",
    " Horaria",
)


def es_linea_basura(linea):
    linea = linea.strip()
    if linea in BASURA_EXACTA:
        return True
    normalizada = " ".join(linea.split())
    if normalizada in BASURA_EXACTA:
        return True
    return any(linea.startswith(p) for p in BASURA_PREFIJOS)


def limpiar_sufijos_encabezado(nombre: str) -> str:
    for sufijo in _SUFIJOS_ENCABEZADO:
        if nombre.endswith(sufijo):
            return nombre[: -len(sufijo)].strip()
    return nombre


def limpiar_texto(texto):
    lineas_limpias = []

    for linea in texto.splitlines():
        linea = linea.strip()

        if not linea:
            continue

        if es_linea_basura(linea):
            continue

        lineas_limpias.append(linea)

    texto_limpio = "\n".join(lineas_limpias)
    texto_limpio = recomponer_lineas_partidas(texto_limpio)
    return texto_limpio


PATRON_INICIO_CORRELATIVA_PROSA = re.compile(
    r'^(Para|Haber|Tener|Aprobar|Cursar|Debe|Deberá)\b',
    re.IGNORECASE
)

PATRON_CORR_INCOMPLETA = re.compile(
    r'^[A-Z]?\d{4,}\s+(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)

PATRON_ESTADO_SOLO = re.compile(
    r'^(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)

PATRON_FINAL_MATERIA_CON_CORR_INCOMPLETA = re.compile(
    r'^(.*\S)\s+([A-Z]?\d{4,})\s+(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)


def recomponer_lineas_partidas(texto):
    lineas = [l.strip() for l in texto.splitlines() if l.strip()]
    resultado = []

    i = 0
    while i < len(lineas):
        actual = lineas[i]

        # Caso 1:
        # "2405 Aprobada"
        # "Aprobada"
        if (
            PATRON_CORR_INCOMPLETA.match(actual)
            and i + 1 < len(lineas)
            and PATRON_ESTADO_SOLO.match(lineas[i + 1])
        ):
            resultado.append(actual + " " + lineas[i + 1])
            i += 2
            continue

        # Caso 2:
        # "3894 PRACTICA PRE PROFESIONAL ASISTIDA 2405 Aprobada"
        # "Aprobada"
        if (
            PATRON_FINAL_MATERIA_CON_CORR_INCOMPLETA.match(actual)
            and i + 1 < len(lineas)
            and PATRON_ESTADO_SOLO.match(lineas[i + 1])
        ):
            resultado.append(actual + " " + lineas[i + 1])
            i += 2
            continue

        # Caso 3: continuación de nombre de materia en línea siguiente uppercase sin ID
        # "9167 DERECHO INTERNACIONAL"
        # "PRIVADO"   <- uppercase, sin ID numérico, no es agrupador ni correlativa
        siguiente = lineas[i + 1] if i + 1 < len(lineas) else None
        if (
            siguiente is not None
            and PATRON_MATERIA.match(actual)
            and re.match(r'^[A-Z]', siguiente)
            and not re.match(r'^[A-Z]?\d', siguiente)
            and not PATRON_ANIO.match(siguiente)
            and not PATRON_CUATRIMESTRE.match(siguiente)
            and not PATRON_SECCION_OPTATIVAS.match(siguiente)
            and not PATRON_SECCION_IDIOMAS.match(siguiente)
            and not PATRON_SECCION_SEMINARIOS.match(siguiente)
            and not PATRON_SECCION_ORIENTACION.match(siguiente)
            and not PATRON_CORRELATIVA_SOLO.match(siguiente)
            and not PATRON_CORRELATIVA_UN_ESTADO_SOLO.match(siguiente)
            and not es_linea_basura(siguiente)
            and not PATRON_INICIO_CORRELATIVA_PROSA.match(siguiente)
        ):
            resultado.append(actual + " " + siguiente)
            i += 2
            continue

        # Caso 4: línea de prosa que termina en artículo/preposición colgante
        # "Para cursar Debe aprobarse el Examen de Comprensión de Inglés II antes de iniciar el"
        # "cursado del cuarto año."
        # La siguiente empieza en minúscula y no es materia ni correlativa.
        if (
            siguiente is not None
            and PATRON_INICIO_CORRELATIVA_PROSA.match(actual)
            and re.search(r'\b(el|la|los|las|un|una|de|del|que|y|e|o|u|a)\s*$', actual, re.IGNORECASE)
            and re.match(r'^[a-záéíóúü]', siguiente)
            and not re.match(r'^[A-Z]?\d', siguiente)
        ):
            resultado.append(actual + " " + siguiente)
            i += 2
            continue

        resultado.append(actual)
        i += 1

    return "\n".join(resultado)