"""
Agrupa materias por orientación basándose en los encabezados de ORIENTACIÓN.
"""


def agrupar_materias_por_orientacion(resultado_parser):
    """
    Agrupa el resultado del parser en estructura por orientación.
    
    Entrada:
        {
            "plan": {...},
            "materias": [...materias con orientacion/orientaciones...],
            "agrupadores": [...]
        }
    
    Salida:
        {
            "plan": {...},
            "comunes": [...materias sin orientación...],
            "<orientacion_1>": [...materias de esta orientación...],
            "<orientacion_2>": [...],
            ...
            "agrupadores": [...]
        }
    
    Nota: Las materias mantienen sus campos de orientacion/orientaciones originales.
    
    Args:
        resultado_parser: dict con estructura {"plan": ..., "materias": ..., "agrupadores": ...}
    
    Returns:
        dict con estructura agrupada por orientación
    """
    materias = resultado_parser.get("materias", [])
    agrupadores = resultado_parser.get("agrupadores", [])
    plan = resultado_parser.get("plan", {})
    
    # Recopilar todas las orientaciones que aparecen en las materias
    orientaciones_encontradas = set()
    for materia in materias:
        if materia.get("orientacion"):
            orientaciones_encontradas.add(materia["orientacion"])
        elif materia.get("orientaciones"):
            orientaciones_encontradas.update(materia["orientaciones"])
    
    # Ordenar orientaciones de forma determinística
    orientaciones_ordenadas = sorted(orientaciones_encontradas)
    
    # Crear estructura base
    resultado = {
        "plan": plan,
        "comunes": [],
        "agrupadores": agrupadores
    }
    
    # Crear entries para cada orientación en orden
    for ori in orientaciones_ordenadas:
        resultado[ori] = []
    
    # Agrupar materias (mantener campos de orientación)
    for materia in materias:
        # Extraer orientación(es) de la materia
        orientaciones_materia = set()
        
        if materia.get("orientacion"):
            orientaciones_materia.add(materia["orientacion"])
        elif materia.get("orientaciones"):
            orientaciones_materia.update(materia["orientaciones"])
        
        # Si no tiene orientación, es común
        if not orientaciones_materia:
            resultado["comunes"].append(materia)
        else:
            # Agregar a todas las orientaciones que corresponda
            for orientacion in orientaciones_materia:
                if orientacion in resultado:
                    resultado[orientacion].append(materia)
    
    # Limpiar secciones vacías (excepto comunes y plan)
    return {k: v for k, v in resultado.items() 
            if v or k in ("plan", "agrupadores", "comunes")}
