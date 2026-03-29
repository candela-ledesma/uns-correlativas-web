def puede_cursar(materia, aprobadas, cursadas):

    correlativas = materia["correlativas"]

    for correlativa_id, requisitos in correlativas.items():

        correlativa_id = int(correlativa_id)
        condicion = requisitos["para_cursar"]

        if condicion == "aprobada":
            if correlativa_id not in aprobadas:
                return False

        elif condicion == "cursada":
            if correlativa_id not in aprobadas and correlativa_id not in cursadas:
                return False

    return True


def materias_disponibles(materias, aprobadas, cursadas):

    disponibles = {}
    
    for materia in materias:

        if materia["id"] in aprobadas:
            continue

        if puede_cursar(materia, aprobadas, cursadas):
            disponibles[materia["id"]] = materia

    return list(disponibles.values())

def simular_aprobar(materias, aprobadas, cursadas, materia_aprobada):

    antes = materias_disponibles(materias, aprobadas, cursadas)

    nuevas_aprobadas = set(aprobadas)
    nuevas_aprobadas.add(materia_aprobada)

    despues = materias_disponibles(materias, nuevas_aprobadas, cursadas)

    antes_ids = {m["id"] for m in antes}
    despues_ids = {m["id"] for m in despues}

    desbloqueadas_ids = despues_ids - antes_ids

    return [m for m in materias if m["id"] in desbloqueadas_ids]