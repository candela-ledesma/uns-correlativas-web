#Recorre las líneas y construye el JSON final.
from .classifiers import clasificar_linea
from .normalizers import normalizar_anio, normalizar_cuatrimestre
from .builders import crear_materia, crear_agrupador, crear_requisito
from .patterns import PATRON_MATERIA, PATRON_CORRELATIVA, PATRON_GRUPO
from .patterns import (
    PATRON_MATERIA,
    PATRON_CORRELATIVA,
    PATRON_CORRELATIVA_UN_ESTADO,
    PATRON_CORRELATIVA_UN_ESTADO_SOLO
)


def extraer_correlativas_de_linea(linea):
    correlativas = {}

    completas = PATRON_CORRELATIVA.findall(linea)
    for cor_id, para_cursar, para_rendir in completas:
        correlativas[cor_id] = crear_requisito(para_cursar, para_rendir)

    linea_restante = PATRON_CORRELATIVA.sub('', linea).strip()

    reducidas = PATRON_CORRELATIVA_UN_ESTADO.findall(linea_restante)
    for cor_id, estado in reducidas:
        correlativas[cor_id] = crear_requisito(None, estado)

    return correlativas


def limpiar_linea_materia(linea):
    linea = PATRON_CORRELATIVA.sub('', linea).strip()
    linea = PATRON_CORRELATIVA_UN_ESTADO.sub('', linea).strip()
    return linea


def parsear_linea_materia(linea, año_actual, cuatrimestre_actual):
    correlativas = extraer_correlativas_de_linea(linea)
    linea_limpia = limpiar_linea_materia(linea)

    match = PATRON_MATERIA.match(linea_limpia)
    if not match:
        return None

    codigo = match.group(1).strip()
    nombre = match.group(2).strip()
    horas = (match.group(3) or "").strip()

    if codigo.upper().startswith("G"):
        return None

    if nombre.lower() in {"aprobada", "cursada", "regular"}:
        return None

    materia = crear_materia(
        id_=codigo,
        nombre=nombre,
        año=año_actual,
        cuatrimestre=cuatrimestre_actual,
        horas=horas
    )

    materia["correlativas"].update(correlativas)

    return materia


def detectar_materias_generico(texto):
    materias = []
    agrupadores = []

    materias_index = {}
    agrupadores_index = {}

    año_actual = None
    cuatrimestre_actual = None
    seccion_actual = "normal"
    grupo_actual = None

    lineas = [l.strip() for l in texto.splitlines() if l.strip()]

    for linea in lineas:
        tipo = clasificar_linea(linea, seccion_actual)

        if tipo in ("vacia", "basura", "desconocida"):
            continue

        if tipo == "anio":
            año_actual = normalizar_anio(linea)
            continue

        if tipo == "cuatrimestre":
            cuatrimestre_actual = normalizar_cuatrimestre(linea)
            continue

        if tipo == "seccion_optativas":
            seccion_actual = "optativas"
            grupo_actual = None
            continue

        if tipo == "seccion_idiomas":
            seccion_actual = "idiomas"
            grupo_actual = "IDIOMAS"
            if grupo_actual not in agrupadores_index:
                agrupador = crear_agrupador("IDIOMAS", "Lenguas / Idiomas", "idioma_grupo")
                agrupadores.append(agrupador)
                agrupadores_index[grupo_actual] = agrupador
            continue

        if tipo == "seccion_seminarios":
            seccion_actual = "seminarios"
            grupo_actual = "SEMINARIOS"
            if grupo_actual not in agrupadores_index:
                agrupador = crear_agrupador("SEMINARIOS", "Seminarios", "seminario_grupo")
                agrupadores.append(agrupador)
                agrupadores_index[grupo_actual] = agrupador
            continue

        if tipo == "grupo":
            mg = PATRON_GRUPO.match(linea)
            codigo = mg.group(1).strip()
            nombre = mg.group(2).strip() or f"Grupo {codigo}"

            grupo_actual = codigo

            if codigo not in agrupadores_index:
                agrupador = crear_agrupador(codigo, nombre, "optativa_grupo")
                agrupadores.append(agrupador)
                agrupadores_index[codigo] = agrupador

            continue

        if tipo == "materia":
            materia = parsear_linea_materia(linea, año_actual, cuatrimestre_actual)
            if materia:
                materias.append(materia)
                materias_index[materia["id"]] = materia

                if grupo_actual is not None and grupo_actual in agrupadores_index:
                    agrupadores_index[grupo_actual]["opciones"].append(materia["id"])
            continue

        if tipo == "correlativa" and materias:
            materia_actual = materias[-1]
            print("ULTIMA MATERIA:", materia_actual["id"], materia_actual["nombre"])
            print("LINEA CORRELATIVA:", linea)
            correlativas = extraer_correlativas_de_linea(linea)
            print("EXTRAIDAS:", correlativas)
            materia_actual["correlativas"].update(correlativas)
            continue

    return {
        "materias": materias,
        "agrupadores": agrupadores
    }