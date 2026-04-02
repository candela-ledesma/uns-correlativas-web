import re

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

        resultado.append(actual)
        i += 1

    return "\n".join(resultado)