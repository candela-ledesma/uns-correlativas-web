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
    "Ir a Moodle UNS"
}


def es_linea_basura(linea):
    return linea.strip() in BASURA_EXACTA


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
        ):
            resultado.append(actual + " " + siguiente)
            i += 2
            continue

        resultado.append(actual)
        i += 1

    return "\n".join(resultado)