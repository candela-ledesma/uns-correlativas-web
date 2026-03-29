
def _to_int_set(iterable):
    if iterable is None:
        return set()
    if isinstance(iterable, set):
        # asegurar que contiene ints
        return {int(x) for x in iterable}
    try:
        return {int(x) for x in iterable}
    except Exception:
        return set()

# puede_cursar(materia, aprobadas, cursadas)
# devuelve True si se cumplen todas las correlativas para cursar la materia
def puede_cursar(materia, aprobadas, cursadas):
    aprobadas_set = _to_int_set(aprobadas)
    cursadas_set = _to_int_set(cursadas)

    correlativas = materia.get("correlativas") or {}

    for correlativa_id_key, requisitos in correlativas.items():
        try:
            correlativa_id = int(correlativa_id_key)
        except Exception:
            continue

        condicion = (requisitos.get("para_cursar") or "").lower()

        if condicion == "aprobada":
            if correlativa_id not in aprobadas_set:
                return False
        elif condicion == "cursada":
            if correlativa_id not in aprobadas_set and correlativa_id not in cursadas_set:
                return False
        else:
            # si no hay condición explícita, asumimos que no impide cursar
            continue

    return True

# materias_disponibles(materias, aprobadas, cursadas) devuelve la lista de materias que el alumno puede cursar
def materias_disponibles(materias, aprobadas, cursadas):
    aprobadas_set = _to_int_set(aprobadas)
    cursadas_set = _to_int_set(cursadas)

    disponibles = []

    for materia in materias:
        try:
            mid = int(materia.get("id"))
        except Exception:
            continue

        if mid in aprobadas_set:
            continue

        if puede_cursar(materia, aprobadas_set, cursadas_set):
            disponibles.append(materia)

    return disponibles

# simular_aprobar(materias, aprobadas, cursadas, materia_aprobada)
# devuelve la lista de materias que se desbloquearían si se aprueba `materia_aprobada`
def simular_aprobar(materias, aprobadas, cursadas, materia_aprobada):
    aprobadas_set = _to_int_set(aprobadas)
    antes = materias_disponibles(materias, aprobadas_set, cursadas)

    nuevas_aprobadas = set(aprobadas_set)
    try:
        nuevas_aprobadas.add(int(materia_aprobada))
    except Exception:
        pass

    despues = materias_disponibles(materias, nuevas_aprobadas, cursadas)

    antes_ids = {m.get("id") for m in antes}
    despues_ids = {m.get("id") for m in despues}

    desbloqueadas_ids = set(despues_ids) - set(antes_ids)

    return [m for m in materias if m.get("id") in desbloqueadas_ids]
