#Recorre las líneas y construye el JSON final.
from .classifiers import clasificar_linea
from .normalizers import normalizar_anio, normalizar_cuatrimestre
from .builders import crear_materia, crear_agrupador, crear_requisito
from .patterns import (
    PATRON_MATERIA,
    PATRON_CORRELATIVA,
    PATRON_CORRELATIVA_UN_ESTADO,
    PATRON_GRUPO
)
from .categorizer import detectar_categoria_y_subtipo
from .grupo_detector import es_linea_agrupador
import re

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


def parsear_linea_materia(linea, año_actual, cuatrimestre_actual, seccion_actual=None, grupo_actual=None):
    correlativas = extraer_correlativas_de_linea(linea)
    linea_limpia = limpiar_linea_materia(linea)

    match = PATRON_MATERIA.match(linea_limpia)
    if not match:
        return None

    codigo = match.group(1).strip()
    nombre = match.group(2).strip()
    horas = (match.group(3) or "").strip()

    if codigo.upper().startswith("G"):
        return crear_materia(
            id_=codigo,
            nombre=nombre,
            año=año_actual,
            cuatrimestre=cuatrimestre_actual,
            horas=horas,
            tipo="agrupador_requisito",
            categoria="normal",
            grupo_opcion=None,
            subtipo=None
        )

    if nombre.lower() in {"aprobada", "cursada", "regular"}:
        return None

    categoria, subtipo = detectar_categoria_y_subtipo(nombre, grupo_actual)

    materia = crear_materia(
        id_=codigo,
        nombre=nombre,
        año=año_actual,
        cuatrimestre=cuatrimestre_actual,
        horas=horas,
        categoria=categoria,
        grupo_opcion=grupo_actual,
        subtipo=subtipo
    )

    materia["correlativas"].update(correlativas)

    return materia

def extraer_info_plan(texto):
    carrera = None
    universidad = None
    codigo_plan = None

    lineas = [l.strip() for l in texto.splitlines() if l.strip()]

    for linea in lineas[:80]:
        linea_limpia = " ".join(linea.split())

        if "UNIVERSIDAD NACIONAL DEL SUR" in linea_limpia.upper():
            universidad = "Universidad Nacional del Sur"

        match = re.search(r'(.+?)\.\s*\((Plan[^)]+)\)', linea_limpia, re.IGNORECASE)
        if match:
            carrera = match.group(1).strip().title()
            codigo_plan = match.group(2).strip()
            break

    return {
        "carrera": carrera or "Carrera desconocida",
        "universidad": universidad or "Universidad Nacional del Sur",
        "codigo_plan": codigo_plan or "Plan desconocido"
    }

def detectar_materias_generico(texto):
    info_plan = extraer_info_plan(texto)

    materias = []
    agrupadores = []

    materias_index = {}
    agrupadores_index = {}

    año_actual = None
    cuatrimestre_actual = None
    seccion_actual = "normal"
    grupo_actual = None
    materia_actual = None

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
            materia_actual = None
            continue

        if tipo == "seccion_idiomas":
            seccion_actual = "idiomas"
            grupo_actual = "IDIOMAS"
            materia_actual = None

            if grupo_actual not in agrupadores_index:
                agrupador = crear_agrupador(
                    "IDIOMAS",
                    "Lenguas / Idiomas",
                    "idioma_grupo"
                )
                agrupadores.append(agrupador)
                agrupadores_index[grupo_actual] = agrupador
            continue

        if tipo == "seccion_seminarios":
            seccion_actual = "seminarios"
            grupo_actual = "SEMINARIOS"
            materia_actual = None

            if grupo_actual not in agrupadores_index:
                agrupador = crear_agrupador(
                    "SEMINARIOS",
                    "Seminarios",
                    "seminario_grupo"
                )
                agrupadores.append(agrupador)
                agrupadores_index[grupo_actual] = agrupador
            continue

        if tipo == "grupo":
            mg = PATRON_GRUPO.match(linea)
            codigo = mg.group(1).strip()
            nombre = mg.group(2).strip() or f"Grupo {codigo}"

            grupo_actual = codigo
            materia_actual = None

            if codigo not in agrupadores_index:
                agrupador = crear_agrupador(codigo, nombre, "optativa_grupo")
                agrupadores.append(agrupador)
                agrupadores_index[codigo] = agrupador

            continue

        agrupador_info = es_linea_agrupador(linea, seccion_actual)
        if agrupador_info:
            codigo = agrupador_info["codigo"]
            nombre = agrupador_info["nombre"]
            tipo_agrupador = agrupador_info["tipo"]

            grupo_actual = codigo
            materia_actual = None

            if tipo_agrupador == "idioma_grupo":
                seccion_actual = "idiomas"
            elif tipo_agrupador == "seminario_grupo":
                seccion_actual = "seminarios"

            if codigo not in agrupadores_index:
                agrupador = crear_agrupador(codigo, nombre, tipo_agrupador)
                agrupadores.append(agrupador)
                agrupadores_index[codigo] = agrupador

            continue

        if tipo == "materia":
            materia_parseada = parsear_linea_materia(
                linea,
                año_actual,
                cuatrimestre_actual,
                seccion_actual,
                grupo_actual
            )

            if materia_parseada:
                materia_id = str(materia_parseada["id"])
                materia_parseada["id"] = materia_id

                if materia_id not in materias_index:
                    materias.append(materia_parseada)
                    materias_index[materia_id] = materia_parseada
                    materia_actual = materia_parseada
                else:
                    materia_existente = materias_index[materia_id]

                    if not materia_existente.get("horas") and materia_parseada.get("horas"):
                        materia_existente["horas"] = materia_parseada["horas"]

                    if not materia_existente.get("año") and materia_parseada.get("año"):
                        materia_existente["año"] = materia_parseada["año"]

                    if (
                        not materia_existente.get("cuatrimestre")
                        and materia_parseada.get("cuatrimestre")
                    ):
                        materia_existente["cuatrimestre"] = materia_parseada["cuatrimestre"]

                    if not materia_existente.get("subtipo") and materia_parseada.get("subtipo"):
                        materia_existente["subtipo"] = materia_parseada["subtipo"]

                    if (
                        materia_existente.get("categoria") == "normal"
                        and materia_parseada.get("categoria") != "normal"
                    ):
                        materia_existente["categoria"] = materia_parseada.get("categoria")

                    if not materia_existente.get("grupo_opcion") and materia_parseada.get("grupo_opcion"):
                        materia_existente["grupo_opcion"] = materia_parseada.get("grupo_opcion")

                    if (
                        materia_existente.get("tipo") == "materia"
                        and materia_parseada.get("tipo") != "materia"
                    ):
                        materia_existente["tipo"] = materia_parseada.get("tipo")

                    if materia_parseada.get("correlativas"):
                        materia_existente["correlativas"].update(
                            materia_parseada["correlativas"]
                        )

                    materia_actual = materia_existente

                if grupo_actual is not None and grupo_actual in agrupadores_index:
                    opciones = agrupadores_index[grupo_actual]["opciones"]
                    if materia_id not in opciones:
                        opciones.append(materia_id)

            continue

        if tipo == "correlativa" and materia_actual is not None:
            correlativas = extraer_correlativas_de_linea(linea)
            materia_actual["correlativas"].update(correlativas)
            continue

    for agrupador in agrupadores:
        agrupador["opciones"] = list(dict.fromkeys(str(op) for op in agrupador["opciones"]))

    return {
        "plan": info_plan,
        "materias": materias,
        "agrupadores": agrupadores
    }