#Recorre las líneas y construye el JSON final.
from .classifiers import clasificar_linea
from .normalizers import normalizar_anio, normalizar_cuatrimestre
from .builders import crear_materia, crear_agrupador, crear_requisito
from .patterns import (
    PATRON_MATERIA,
    PATRON_CORRELATIVA,
    PATRON_CORRELATIVA_UN_ESTADO,
    PATRON_GRUPO,
    PATRON_SECCION_OPTATIVAS,
)
from .categorizer import detectar_categoria_y_subtipo
from .grupo_detector import es_linea_agrupador
import re
import unicodedata


def extraer_orientacion_desde_nombre(nombre):
    if not isinstance(nombre, str):
        return None

    match = re.search(
        r"orientaci[oó]n\s+([^,]+?)(?:,|$)",
        nombre,
        re.IGNORECASE,
    )
    if not match:
        return None

    orientacion = match.group(1).strip()
    return orientacion or None


def normalizar_texto(valor):
    if not isinstance(valor, str):
        return ""

    valor = valor.lower().strip()
    valor = "".join(
        c for c in unicodedata.normalize("NFD", valor) if unicodedata.category(c) != "Mn"
    )
    return valor


def debe_anotar_orientacion(nombre_materia, orientacion_contexto):
    orientacion = normalizar_texto(orientacion_contexto)
    nombre = normalizar_texto(nombre_materia)

    if not orientacion or not nombre:
        return False

    if orientacion == "hidraulica":
        return "hidraulic" in nombre

    if orientacion == "vias de comunicacion":
        return "ferrocarril" in nombre or "carretera" in nombre

    # Construcciones incluye muchas materias troncales compartidas;
    # no se etiqueta automaticamente para evitar excluirlas en otros filtros.
    if orientacion == "construcciones":
        return False

    return False

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


def construir_marcadores_orientacion(lineas):
    indice_optativas = None

    for index, linea in enumerate(lineas):
        if PATRON_SECCION_OPTATIVAS.match(linea):
            indice_optativas = index
            break

    limite = indice_optativas if indice_optativas is not None else len(lineas)
    marcadores = []

    for index in range(limite):
        match = PATRON_MATERIA.match(lineas[index])
        if not match:
            continue

        codigo = match.group(1).strip()
        if not codigo.upper().startswith("G"):
            continue

        nombre = match.group(2).strip()
        orientacion = extraer_orientacion_desde_nombre(nombre)
        if orientacion:
            marcadores.append((index, orientacion))

    return marcadores


def obtener_orientacion_cercana(
    index_linea,
    marcadores,
    max_distancia=80,
    preferir_siguiente_hasta=60,
):
    if not marcadores:
        return None

    marcador_previo = None
    marcador_siguiente = None

    for index_marcador, orientacion in marcadores:
        if index_marcador <= index_linea:
            marcador_previo = (index_marcador, orientacion)

        if index_marcador >= index_linea:
            marcador_siguiente = (index_marcador, orientacion)
            break

    if marcador_siguiente:
        distancia_siguiente = marcador_siguiente[0] - index_linea
        if distancia_siguiente <= preferir_siguiente_hasta:
            return marcador_siguiente[1]

    if marcador_previo:
        distancia_previa = index_linea - marcador_previo[0]
        if distancia_previa <= max_distancia:
            return marcador_previo[1]

    if marcador_siguiente:
        distancia_siguiente = marcador_siguiente[0] - index_linea
        if distancia_siguiente <= max_distancia:
            return marcador_siguiente[1]

    return None


def parsear_linea_materia(
    linea,
    año_actual,
    cuatrimestre_actual,
    seccion_actual=None,
    grupo_actual=None,
    orientacion_contexto=None,
):
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

    if (
        orientacion_contexto
        and seccion_actual == "normal"
        and grupo_actual is None
        and debe_anotar_orientacion(nombre, orientacion_contexto)
    ):
        materia["orientaciones"] = [orientacion_contexto]

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
    marcadores_orientacion = construir_marcadores_orientacion(lineas)

    for index_linea, linea in enumerate(lineas):
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

            orientacion_grupo = extraer_orientacion_desde_nombre(nombre)
            if orientacion_grupo:
                agrupadores_index[codigo]["orientacion"] = orientacion_grupo

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

            orientacion_grupo = extraer_orientacion_desde_nombre(nombre)
            if orientacion_grupo:
                agrupadores_index[codigo]["orientacion"] = orientacion_grupo

            continue

        if tipo == "materia":
            orientacion_contexto = None
            if seccion_actual == "normal":
                orientacion_contexto = obtener_orientacion_cercana(
                    index_linea,
                    marcadores_orientacion,
                )

            materia_parseada = parsear_linea_materia(
                linea,
                año_actual,
                cuatrimestre_actual,
                seccion_actual,
                grupo_actual,
                orientacion_contexto,
            )

            if materia_parseada:
                materia_id = str(materia_parseada["id"])
                materia_parseada["id"] = materia_id

                if (
                    seccion_actual == "normal"
                    and materia_parseada.get("tipo") == "agrupador_requisito"
                ):
                    orientacion_detectada = extraer_orientacion_desde_nombre(
                        materia_parseada.get("nombre", "")
                    )
                    if orientacion_detectada:
                        materia_parseada["orientacion"] = orientacion_detectada

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

                    orientaciones_unificadas = []

                    for orientacion in (
                        materia_existente.get("orientaciones") or []
                    ):
                        if orientacion not in orientaciones_unificadas:
                            orientaciones_unificadas.append(orientacion)

                    orientacion_existente = materia_existente.get("orientacion")
                    if (
                        isinstance(orientacion_existente, str)
                        and orientacion_existente
                        and orientacion_existente not in orientaciones_unificadas
                    ):
                        orientaciones_unificadas.append(orientacion_existente)

                    for orientacion in (
                        materia_parseada.get("orientaciones") or []
                    ):
                        if orientacion not in orientaciones_unificadas:
                            orientaciones_unificadas.append(orientacion)

                    orientacion_parseada = materia_parseada.get("orientacion")
                    if (
                        isinstance(orientacion_parseada, str)
                        and orientacion_parseada
                        and orientacion_parseada not in orientaciones_unificadas
                    ):
                        orientaciones_unificadas.append(orientacion_parseada)

                    if len(orientaciones_unificadas) == 1:
                        materia_existente["orientacion"] = orientaciones_unificadas[0]
                        materia_existente.pop("orientaciones", None)
                    elif len(orientaciones_unificadas) > 1:
                        materia_existente["orientaciones"] = orientaciones_unificadas
                        materia_existente.pop("orientacion", None)

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

        if agrupador.get("tipo") == "optativa_grupo" and "orientacion" not in agrupador:
            orientacion = extraer_orientacion_desde_nombre(agrupador.get("nombre", ""))
            if orientacion:
                agrupador["orientacion"] = orientacion

    return {
        "plan": info_plan,
        "materias": materias,
        "agrupadores": agrupadores
    }