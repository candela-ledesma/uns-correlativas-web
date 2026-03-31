from .patterns import PATRON_GRUPO, PATRON_CORRELATIVA_SOLO, PATRON_CORRELATIVA_UN_ESTADO_SOLO

def detectar_tipo_agrupador(codigo, nombre, seccion_actual):
    codigo_upper = codigo.upper()
    nombre_upper = nombre.upper()

    if seccion_actual == "optativas":
        if "IDIOMA" in nombre_upper or "LENGUA" in nombre_upper:
            return "idioma_grupo"

        if "SEMINARIO" in nombre_upper and len(nombre_upper.split()) <= 3:
            return "seminario_grupo"

        if codigo_upper.startswith("G"):
            return "optativa_grupo"

        if codigo_upper.startswith("I") and ("IDIOMA" in nombre_upper or "LENGUA" in nombre_upper):
            return "idioma_grupo"

    if seccion_actual == "idiomas":
        if codigo_upper.startswith("I") or "IDIOMA" in nombre_upper or "LENGUA" in nombre_upper:
            return "idioma_grupo"

    if seccion_actual == "seminarios":
        return "seminario_grupo"

    return None

def es_linea_agrupador(linea, seccion_actual):
    # si la línea es una correlativa, no puede ser agrupador
    if PATRON_CORRELATIVA_SOLO.match(linea):
        return None

    if PATRON_CORRELATIVA_UN_ESTADO_SOLO.match(linea):
        return None

    mg = PATRON_GRUPO.match(linea)
    if not mg:
        return None

    codigo = mg.group(1).strip()
    nombre = mg.group(2).strip()

    # evitar cosas tipo: I2201 Aprobada Aprobada
    if nombre.upper() in {"APROBADA", "CURSADA", "REGULAR", "APROBADA APROBADA"}:
        return None

    tipo_agrupador = detectar_tipo_agrupador(codigo, nombre, seccion_actual)
    if tipo_agrupador is None:
        return None

    return {
        "codigo": codigo,
        "nombre": nombre or f"Grupo {codigo}",
        "tipo": tipo_agrupador
    }