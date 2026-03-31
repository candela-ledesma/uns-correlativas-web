def cumple_estado(estado_actual, estado_requerido):
    actual = (estado_actual or "").lower()
    requerido = (estado_requerido or "").lower()

    if requerido == "cursada":
        return actual in ("cursada", "aprobada")
    if requerido == "regular":
        return actual in ("regular", "cursada", "aprobada")
    if requerido == "aprobada":
        return actual == "aprobada"

    return False