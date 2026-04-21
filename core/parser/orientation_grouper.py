"""
Procesa el resultado del parser para mantener integridad de orientaciones.
"""


def agrupar_materias_por_orientacion(resultado_parser):
    """
    Retorna el resultado del parser sin modificar la estructura.
    
    El parser ya asigna correctamente los campos orientacion/orientaciones en cada materia
    basándose en los encabezados de ORIENTACIÓN detectados en el PDF.
    
    El frontend manejará la agrupación visual basándose en estos campos.
    
    Args:
        resultado_parser: dict con estructura {"plan": ..., "materias": ..., "agrupadores": ...}
    
    Returns:
        dict sin cambios (estructura esperada por el frontend)
    """
    return resultado_parser
