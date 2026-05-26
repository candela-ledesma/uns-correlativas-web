def detectar_categoria_y_subtipo(nombre, grupo_actual=None):
    nombre_upper = nombre.upper()

    subtipo = None
    if "IDIOMA" in nombre_upper or "INGLES" in nombre_upper:
        subtipo = "idioma"
    elif nombre_upper.startswith("SEMINARIO"):
        subtipo = "seminario"

    if grupo_actual is not None:
        return "optativa", subtipo

    return "normal", subtipo