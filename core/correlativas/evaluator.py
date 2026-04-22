# Valida si una materia está disponible según correlativas, incluyendo grupos optativos.
from .helpers import cumple_estado


def indexar_agrupadores(agrupadores):
    return {a["id"]: a for a in agrupadores}


def agrupador_cumplido(agrupador, estado_materias, nivel_requerido):
    for materia_id in agrupador.get("opciones", []):
        estado = estado_materias.get(materia_id, "no_cursada")
        if cumple_estado(estado, nivel_requerido):
            return True
    return False


def materia_habilitada(materia, estado_materias, agrupadores_index):
    for cor_id, requisito in materia.get("correlativas", {}).items():
        nivel = requisito.get("para_cursar")

        if not nivel:
            continue

        if cor_id in agrupadores_index:
            if not agrupador_cumplido(agrupadores_index[cor_id], estado_materias, nivel):
                return False
        else:
            estado = estado_materias.get(cor_id, "no_cursada")
            if not cumple_estado(estado, nivel):
                return False

    return True


def calcular_materias_habilitadas(data, estado_materias):
    materias = data.get("materias", [])
    agrupadores = data.get("agrupadores", [])
    agrupadores_index = indexar_agrupadores(agrupadores)

    habilitadas = []

    for materia in materias:
        materia_id = materia["id"]
        estado_actual = estado_materias.get(materia_id, "no_cursada")

        # si ya está aprobada, normalmente no interesa mostrarla como disponible
        if estado_actual == "aprobada":
            continue

        if materia_habilitada(materia, estado_materias, agrupadores_index):
            habilitadas.append(materia)

    return habilitadas