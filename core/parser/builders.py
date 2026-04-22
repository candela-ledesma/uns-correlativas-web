# Arma estructuras: materia, agrupador, correlativa.

def crear_materia(
    id_,
    nombre,
    año,
    cuatrimestre,
    horas="",
    tipo="materia",
    categoria="normal",
    grupo_opcion=None,
    subtipo=None
):
    return {
        "id": str(id_),
        "nombre": nombre.strip(),
        "año": año,
        "cuatrimestre": cuatrimestre,
        "horas": str(horas).strip() if horas else "",
        "tipo": tipo,
        "categoria": categoria,
        "grupo_opcion": grupo_opcion,
        "subtipo": subtipo,
        "correlativas": {}
    }


def crear_agrupador(id_, nombre, tipo):
    return {
        "id": str(id_),
        "nombre": nombre.strip(),
        "tipo": tipo,
        "opciones": []
    }


def crear_requisito(para_cursar=None, para_rendir=None):
    return {
        "para_cursar": para_cursar.lower() if isinstance(para_cursar, str) else para_cursar,
        "para_rendir": para_rendir.lower() if isinstance(para_rendir, str) else para_rendir
    }