# Recorre las líneas y construye el JSON final.
import re
import unicodedata

from .classifiers import clasificar_linea
from .normalizers import normalizar_anio, normalizar_cuatrimestre
from .builders import crear_materia, crear_agrupador, crear_requisito
from .patterns import (
    PATRON_MATERIA,
    PATRON_CORRELATIVA,
    PATRON_CORRELATIVA_UN_ESTADO,
    PATRON_GRUPO,
    PATRON_SECCION_ORIENTACION,
)
from .categorizer import detectar_categoria_y_subtipo
from .grupo_detector import es_linea_agrupador
from .correlativa_prosa import inferir_correlativa_en_prosa, inferir_requisito_especial


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


def formatear_orientacion(orientacion):
    if not isinstance(orientacion, str):
        return orientacion

    orientacion_limpia = orientacion.strip()
    if not orientacion_limpia:
        return orientacion_limpia

    if orientacion_limpia != orientacion_limpia.upper():
        return orientacion_limpia

    minusculas = {"de", "del", "la", "las", "los", "y", "e"}
    partes = orientacion_limpia.lower().split()
    formateadas = []

    for index, parte in enumerate(partes):
        if index > 0 and parte in minusculas:
            formateadas.append(parte)
        else:
            formateadas.append(parte.capitalize())

    return " ".join(formateadas)


def normalizar_orientacion(orientacion, orientaciones_canonicas_por_normalizada):
    if not isinstance(orientacion, str):
        return None

    orientacion_limpia = orientacion.strip()
    if not orientacion_limpia:
        return None

    orientacion_normalizada = normalizar_texto(orientacion_limpia)
    if not orientacion_normalizada:
        return None

    return orientaciones_canonicas_por_normalizada.get(
        orientacion_normalizada,
        orientacion_limpia,
    )


def detectar_orientaciones_por_nombre(nombre_materia):
    nombre = normalizar_texto(nombre_materia)
    if not nombre:
        return set()

    orientaciones = set()

    if "hidraulic" in nombre:
        orientaciones.add("Hidráulica")

    if "ferrocarril" in nombre or "carretera" in nombre:
        orientaciones.add("Vías de Comunicación")

    return orientaciones


def orden_orientacion(orientacion, orientaciones_ordenadas):
    try:
        return orientaciones_ordenadas.index(orientacion)
    except ValueError:
        return len(orientaciones_ordenadas)


def asignar_orientaciones_materia(materia, orientaciones_ordenadas, orientaciones_set):
    materia.pop("orientacion", None)
    materia.pop("orientaciones", None)

    orientaciones_ordenadas_materia = sorted(
        orientaciones_set,
        key=lambda orientacion: (orden_orientacion(orientacion, orientaciones_ordenadas), orientacion),
    )

    if len(orientaciones_ordenadas_materia) == 1:
        materia["orientacion"] = orientaciones_ordenadas_materia[0]
        return

    if len(orientaciones_ordenadas_materia) > 1:
        materia["orientaciones"] = orientaciones_ordenadas_materia

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


def parsear_linea_materia(
    linea,
    año_actual,
    cuatrimestre_actual,
    seccion_actual=None,
    grupo_actual=None,
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
    colisiones_id = []  # IDs que colisionan entre materias y agrupadores
    warnings_prosa = []  # Warnings de correlativas inferidas desde texto en prosa
    # Warnings emitidos por prosa de la materia actual: {cor_id: texto_warning}
    # Se descarta cuando aparece un requisito_especial que reemplaza esas correlativas.
    warnings_prosa_materia_actual: dict = {}

    año_actual = None
    cuatrimestre_actual = None
    seccion_actual = "normal"
    grupo_actual = None
    materia_actual = None

    orientacion_actual = None
    orientaciones_ordenadas = []
    orientaciones_canonicas_por_normalizada = {}

    orientaciones_normales_por_materia = {}
    materias_normales_sin_orientacion = set()
    grupos_optativos_por_materia = {}
    orientaciones_optativas_por_materia = {}
    
    # Rastrear ubicación (año/cuatrimestre) por orientación para cada materia
    ubicacion_por_orientacion_por_materia = {}

    def registrar_orientacion(orientacion):
        if not isinstance(orientacion, str):
            return None

        orientacion_limpia = formatear_orientacion(orientacion)
        if not orientacion_limpia:
            return None

        orientacion_normalizada = normalizar_texto(orientacion_limpia)
        if not orientacion_normalizada:
            return None

        if orientacion_normalizada not in orientaciones_canonicas_por_normalizada:
            orientaciones_canonicas_por_normalizada[orientacion_normalizada] = orientacion_limpia
            orientaciones_ordenadas.append(orientacion_limpia)

        return orientaciones_canonicas_por_normalizada[orientacion_normalizada]

    lineas = [l.strip() for l in texto.splitlines() if l.strip()]

    for linea in lineas:
        tipo = clasificar_linea(linea, seccion_actual)

        if tipo in ("vacia", "basura"):
            continue

        if tipo == "seccion_orientacion":
            match_orientacion = PATRON_SECCION_ORIENTACION.match(linea)
            if match_orientacion:
                orientacion_actual = registrar_orientacion(match_orientacion.group(1))
            else:
                orientacion_actual = None

            seccion_actual = "normal"
            grupo_actual = None
            materia_actual = None
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

            ubicacion_previa = None
            if codigo in materias_index:
                colisiones_id.append(codigo)
                ubicacion_previa = materias_index[codigo]
                materias[:] = [m for m in materias if str(m["id"]) != codigo]
                del materias_index[codigo]

            if codigo not in agrupadores_index:
                agrupador = crear_agrupador(codigo, nombre, "optativa_grupo")
                agrupadores.append(agrupador)
                agrupadores_index[codigo] = agrupador

            if ubicacion_previa:
                agr = agrupadores_index[codigo]
                if not agr.get("año") and ubicacion_previa.get("año"):
                    agr["año"] = ubicacion_previa["año"]
                if not agr.get("cuatrimestre") and ubicacion_previa.get("cuatrimestre"):
                    agr["cuatrimestre"] = ubicacion_previa["cuatrimestre"]

            orientacion_grupo = registrar_orientacion(
                extraer_orientacion_desde_nombre(nombre)
            )
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

            ubicacion_previa = None
            if codigo in materias_index:
                colisiones_id.append(codigo)
                ubicacion_previa = materias_index[codigo]
                materias[:] = [m for m in materias if str(m["id"]) != codigo]
                del materias_index[codigo]

            if codigo not in agrupadores_index:
                agrupador = crear_agrupador(codigo, nombre, tipo_agrupador)
                agrupadores.append(agrupador)
                agrupadores_index[codigo] = agrupador

            if ubicacion_previa:
                agr = agrupadores_index[codigo]
                if not agr.get("año") and ubicacion_previa.get("año"):
                    agr["año"] = ubicacion_previa["año"]
                if not agr.get("cuatrimestre") and ubicacion_previa.get("cuatrimestre"):
                    agr["cuatrimestre"] = ubicacion_previa["cuatrimestre"]

            orientacion_grupo = registrar_orientacion(
                extraer_orientacion_desde_nombre(nombre)
            )
            if orientacion_grupo:
                agrupadores_index[codigo]["orientacion"] = orientacion_grupo

            continue

        if tipo == "materia":
            materia_parseada = parsear_linea_materia(
                linea,
                año_actual,
                cuatrimestre_actual,
                seccion_actual,
                grupo_actual,
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

                materia_resuelta = materia_parseada

                if materia_id in agrupadores_index:
                    colisiones_id.append(materia_id)
                    agrupador_existente = agrupadores_index[materia_id]
                    if not agrupador_existente.get("año") and materia_parseada.get("año"):
                        agrupador_existente["año"] = materia_parseada["año"]
                    if not agrupador_existente.get("cuatrimestre") and materia_parseada.get("cuatrimestre"):
                        agrupador_existente["cuatrimestre"] = materia_parseada["cuatrimestre"]
                    materia_actual = None
                    continue

                if materia_id not in materias_index:
                    materias.append(materia_parseada)
                    materias_index[materia_id] = materia_parseada
                    materia_actual = materia_parseada
                    warnings_prosa_materia_actual.clear()
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
                    materia_resuelta = materia_existente
                    materia_actual = materia_existente

                if seccion_actual == "normal" and materia_resuelta.get("tipo") == "materia":
                    if orientacion_actual:
                        orientaciones_normales_por_materia.setdefault(materia_id, set()).add(
                            orientacion_actual
                        )
                        # Rastrear ubicación (año/cuatrimestre) por orientación
                        ubicacion_por_orientacion_por_materia.setdefault(materia_id, {})[orientacion_actual] = {
                            "año": año_actual,
                            "cuatrimestre": cuatrimestre_actual,
                        }
                    else:
                        materias_normales_sin_orientacion.add(materia_id)

                if grupo_actual is not None and grupo_actual in agrupadores_index:
                    opciones = agrupadores_index[grupo_actual]["opciones"]
                    if materia_id not in opciones:
                        opciones.append(materia_id)

                    if seccion_actual == "optativas":
                        grupos_materia = grupos_optativos_por_materia.setdefault(
                            materia_id,
                            [],
                        )
                        if grupo_actual not in grupos_materia:
                            grupos_materia.append(grupo_actual)

                        orientacion_grupo = agrupadores_index[grupo_actual].get("orientacion")
                        if isinstance(orientacion_grupo, str) and orientacion_grupo.strip():
                            orientaciones_optativas_por_materia.setdefault(
                                materia_id,
                                set(),
                            ).add(orientacion_grupo)

            continue

        if tipo == "correlativa" and materia_actual is not None:
            requisito = inferir_requisito_especial(linea)
            if requisito:
                if requisito.get("tipo") == "prueba_idioma":
                    requisito["materiaId"] = str(materia_actual.get("id", ""))
                materia_actual["requisito_especial"] = requisito

                # Solo reemplazar correlativas si es un requisito cuantitativo.
                # Los requisitos de "prueba_idioma" se agregan sin afectar
                # las correlativas que ya fueron detectadas.
                if requisito.get("tipo") == "minimo_materias_aprobadas":
                    for cor_id in list(warnings_prosa_materia_actual.keys()):
                        materia_actual["correlativas"].pop(cor_id, None)
                    for w in warnings_prosa_materia_actual.values():
                        try:
                            warnings_prosa.remove(w)
                        except ValueError:
                            pass
                    warnings_prosa_materia_actual.clear()

            correlativas = extraer_correlativas_de_linea(linea)
            materia_actual["correlativas"].update(correlativas)
            continue

        if tipo == "desconocida" and materia_actual is not None:
            requisito = inferir_requisito_especial(linea)
            if requisito:
                if requisito.get("tipo") == "prueba_idioma":
                    requisito["materiaId"] = str(materia_actual.get("id", ""))
                materia_actual["requisito_especial"] = requisito
                
                # Solo reemplazar correlativas si es un requisito cuantitativo.
                # Los requisitos de "prueba_idioma" se agregan sin afectar
                # las correlativas que ya fueron detectadas.
                if requisito.get("tipo") == "minimo_materias_aprobadas":
                    # Revertir correlativas y warnings de prosa acumulados para esta materia
                    # — el requisito_especial cuantitativo las reemplaza completamente.
                    for cor_id in list(warnings_prosa_materia_actual.keys()):
                        materia_actual["correlativas"].pop(cor_id, None)
                    for w in warnings_prosa_materia_actual.values():
                        try:
                            warnings_prosa.remove(w)
                        except ValueError:
                            pass
                    warnings_prosa_materia_actual.clear()
                
                continue

            ids_conocidos = set(materias_index.keys()) | set(agrupadores_index.keys())
            correlativas_inferidas, ws = inferir_correlativa_en_prosa(linea, ids_conocidos)
            if ws:
                warnings_prosa.extend(ws)
                for cor_id in correlativas_inferidas:
                    warnings_prosa_materia_actual[cor_id] = ws[0]
            if correlativas_inferidas:
                materia_actual["correlativas"].update(correlativas_inferidas)
            continue

    orientaciones_totales = set(orientaciones_ordenadas)
    orientaciones_finales_por_materia = {}

    for materia in materias:
        if materia.get("tipo") != "materia":
            continue

        materia_id = str(materia.get("id"))
        orientaciones_materia = set()

        orientaciones_nombre = {
            normalizar_orientacion(orientacion, orientaciones_canonicas_por_normalizada)
            for orientacion in detectar_orientaciones_por_nombre(materia.get("nombre", ""))
        }
        orientaciones_nombre = {
            orientacion for orientacion in orientaciones_nombre if orientacion
        }

        if materia.get("categoria") == "optativa":
            orientaciones_materia.update(
                orientaciones_optativas_por_materia.get(materia_id, set())
            )

            if len(orientaciones_materia) > 1 and orientaciones_nombre:
                coincidencias = orientaciones_materia.intersection(orientaciones_nombre)
                if len(coincidencias) == 1:
                    orientaciones_materia = coincidencias
            elif not orientaciones_materia and orientaciones_nombre:
                orientaciones_materia.update(orientaciones_nombre)
        else:
            # Primero intenta obtener orientaciones del rastreo durante parsing
            orientaciones_rastreadas = orientaciones_normales_por_materia.get(materia_id, set())
            
            if orientaciones_rastreadas:
                # Si la materia aparece en bloques de orientación, usar eso
                orientaciones_materia.update(orientaciones_rastreadas)
            elif materia_id not in materias_normales_sin_orientacion:
                # Fallback para materias que no fueron rastreadas
                if not orientaciones_materia and orientaciones_nombre:
                    orientaciones_materia.update(orientaciones_nombre)

            if orientaciones_totales and orientaciones_materia == orientaciones_totales:
                # Solo considera como "común" si NO aparece en bloques de orientación
                # (es decir, si no tiene ubicación rastreada)
                if materia_id not in ubicacion_por_orientacion_por_materia:
                    orientaciones_materia.clear()

        orientaciones_finales_por_materia[materia_id] = orientaciones_materia
        asignar_orientaciones_materia(materia, orientaciones_ordenadas, orientaciones_materia)

    for materia in materias:
        if materia.get("categoria") != "optativa":
            continue

        materia_id = str(materia.get("id"))
        grupos_materia = grupos_optativos_por_materia.get(materia_id, [])
        if not grupos_materia:
            continue

        orientaciones_materia = orientaciones_finales_por_materia.get(materia_id, set())
        grupos_coincidentes = []

        if orientaciones_materia:
            for grupo_id in grupos_materia:
                orientacion_grupo = agrupadores_index.get(grupo_id, {}).get("orientacion")
                if orientacion_grupo in orientaciones_materia:
                    grupos_coincidentes.append(grupo_id)

        grupo_preferido = grupos_coincidentes[0] if grupos_coincidentes else grupos_materia[0]
        materia["grupo_opcion"] = grupo_preferido

    for agrupador in agrupadores:
        orientacion_agrupador = agrupador.get("orientacion")
        opciones_filtradas = []

        for opcion in agrupador["opciones"]:
            opcion_id = str(opcion)
            orientaciones_materia = orientaciones_finales_por_materia.get(opcion_id, set())

            if (
                isinstance(orientacion_agrupador, str)
                and orientacion_agrupador
                and orientaciones_materia
                and orientacion_agrupador not in orientaciones_materia
            ):
                continue

            if opcion_id not in opciones_filtradas:
                opciones_filtradas.append(opcion_id)

        agrupador["opciones"] = opciones_filtradas

        if agrupador.get("tipo") == "optativa_grupo" and "orientacion" not in agrupador:
            orientacion = registrar_orientacion(
                extraer_orientacion_desde_nombre(agrupador.get("nombre", ""))
            )
            if orientacion:
                agrupador["orientacion"] = orientacion

    # Agregar ubicación contextualizada por orientación a cada materia
    for materia_id, ubicaciones_por_ori in ubicacion_por_orientacion_por_materia.items():
        if materia_id in materias_index:
            materia = materias_index[materia_id]
            
            # Si la materia aparece en múltiples orientaciones con diferente ubicación,
            # guardar estructura completa. Si es igual en todas, simplificar.
            ubicaciones_lista = list(ubicaciones_por_ori.values())
            todas_iguales = all(
                u == ubicaciones_lista[0] for u in ubicaciones_lista
            )

            if todas_iguales and ubicaciones_lista[0].get("año"):
                materia["año"] = ubicaciones_lista[0]["año"]
                materia["cuatrimestre"] = ubicaciones_lista[0]["cuatrimestre"]
            elif len(ubicaciones_por_ori) > 1:
                materia["ubicacion"] = ubicaciones_por_ori
            elif ubicaciones_lista[0].get("año"):
                materia["año"] = ubicaciones_lista[0]["año"]
                materia["cuatrimestre"] = ubicaciones_lista[0]["cuatrimestre"]

    resultado = {
        "plan": info_plan,
        "materias": materias,
        "agrupadores": agrupadores
    }

    ids_unicos = list(dict.fromkeys(colisiones_id))
    if ids_unicos:
        resultado["_colisiones_id"] = ids_unicos

    if warnings_prosa:
        resultado["_warnings"] = warnings_prosa

    return resultado
