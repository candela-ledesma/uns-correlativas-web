#Decide qué tipo de línea es:
    #año
    #cuatrimestre
    #sección
    #grupo
    #materia
    #correlativa
    #basura

from .patterns import (
    PATRON_ANIO,
    PATRON_CUATRIMESTRE,
    PATRON_SECCION_OPTATIVAS,
    PATRON_SECCION_IDIOMAS,
    PATRON_SECCION_SEMINARIOS,
    PATRON_SECCION_ORIENTACION,
    PATRON_GRUPO,
    PATRON_MATERIA,
    PATRON_CORRELATIVA,
    PATRON_CORRELATIVA_SOLO,
    PATRON_CORRELATIVA_UN_ESTADO_SOLO
)


def es_linea_basura(linea):
    basura = {
        "U N S",
        "NIVERSIDAD ACIONAL DEL UR",
        "Carga",
        "Horaria",
        "Materia",
        "Correlativas",
        "Para cursar",
        "Para rendir"
    }
    return linea.strip() in basura

def clasificar_linea(linea, seccion_actual):
    linea = linea.strip()

    if not linea:
        return "vacia"

    if es_linea_basura(linea):
        return "basura"

    if PATRON_ANIO.match(linea):
        return "anio"

    if PATRON_CUATRIMESTRE.match(linea):
        return "cuatrimestre"

    if PATRON_SECCION_OPTATIVAS.match(linea):
        return "seccion_optativas"

    if PATRON_SECCION_IDIOMAS.match(linea):
        return "seccion_idiomas"

    if PATRON_SECCION_SEMINARIOS.match(linea):
        return "seccion_seminarios"

    if PATRON_SECCION_ORIENTACION.match(linea):
        return "seccion_orientacion"

    if PATRON_CORRELATIVA_SOLO.match(linea):
        return "correlativa"

    if PATRON_CORRELATIVA_UN_ESTADO_SOLO.match(linea):
        return "correlativa"

    if PATRON_CORRELATIVA.search(linea):
        if PATRON_MATERIA.match(PATRON_CORRELATIVA.sub('', linea).strip()):
            return "materia"
        return "correlativa"

    if seccion_actual == "optativas" and PATRON_GRUPO.match(linea):
        codigo = PATRON_GRUPO.match(linea).group(1)
        if codigo.upper().startswith("G"):
            return "grupo"

    if PATRON_MATERIA.match(linea):
        return "materia"

    return "desconocida"