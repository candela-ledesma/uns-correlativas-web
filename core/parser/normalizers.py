def normalizar_anio(linea):
    mapa = {
        "PRIMER AÑO": "Primer Año",
        "SEGUNDO AÑO": "Segundo Año",
        "TERCER AÑO": "Tercer Año",
        "CUARTO AÑO": "Cuarto Año",
        "QUINTO AÑO": "Quinto Año",
        "SEXTO AÑO": "Sexto Año",
    }
    return mapa.get(linea.upper(), linea.title())


def normalizar_cuatrimestre(linea):
    linea_lower = linea.strip().lower()
    if linea_lower == "anual":
        return "Anual"
    if "primer" in linea_lower or "primero" in linea_lower:
        return "Primer Cuatrimestre"
    if "segundo" in linea_lower:
        return "Segundo Cuatrimestre"
    return linea.strip()