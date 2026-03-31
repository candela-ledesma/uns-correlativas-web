#Normaliza textos:
    #PRIMER AÑO → Primer Año
    #Cuatrimestre: Segundo → Segundo Cuatrimestre

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
    l = linea.strip().lower()
    if l == "anual":
        return "Anual"
    if "primer" in l or "primero" in l:
        return "Primer Cuatrimestre"
    if "segundo" in l:
        return "Segundo Cuatrimestre"
    return linea.strip()