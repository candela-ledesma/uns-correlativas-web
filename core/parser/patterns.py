import re

PATRON_ANIO = re.compile(
    r'^(PRIMER|SEGUNDO|TERCER|CUARTO|QUINTO|SEXTO)\s+AÑO$',
    re.IGNORECASE
)

PATRON_CUATRIMESTRE = re.compile(
    r'^(Anual|Primer Cuatrimestre|Segundo Cuatrimestre|Cuatrimestre:?\s*Primero|Cuatrimestre:?\s*Segundo)$',
    re.IGNORECASE
)

# Materia real: 3942 NOMBRE ... 96hs.
PATRON_MATERIA = re.compile(
    r'^([A-Z]?\d{4,})\s+(.+?)(?:\s+(\d+)\s*hs\.?)?$',
    re.IGNORECASE
)

# Correlativa: 2405 Aprobada Aprobada
PATRON_CORRELATIVA = re.compile(
    r'([A-Z]?\d{4,})\s+(Aprobada|Regular|Cursada)\s+(Aprobada|Regular|Cursada)',
    re.IGNORECASE
)

PATRON_CORRELATIVA_SOLO = re.compile(
    r'^[A-Z]?\d{4,}\s+(Aprobada|Regular|Cursada)\s+(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)

PATRON_CORRELATIVA_UN_ESTADO = re.compile(
    r'([A-Z]?\d{3,})\s+(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)

PATRON_CORRELATIVA_UN_ESTADO_SOLO = re.compile(
    r'^[A-Z]?\d{3,}\s+(Aprobada|Regular|Cursada)$',
    re.IGNORECASE
)
# Grupo abstracto tipo G0624
PATRON_GRUPO = re.compile(
    r'^([A-Z]\d{4,})\s*(.*)$',
    re.IGNORECASE
)

PATRON_SECCION_OPTATIVAS = re.compile(
    r'^MATERIAS\s+OPTATIVAS$',
    re.IGNORECASE
)

PATRON_SECCION_IDIOMAS = re.compile(
    r'^(LENGUAS|IDIOMAS|LENGUAS\s*/\s*IDIOMAS|LENGUAS/IDIOMAS)$',
    re.IGNORECASE
)

PATRON_SECCION_SEMINARIOS = re.compile(
    r'^SEMINARIOS$',
    re.IGNORECASE
)

PATRON_SECCION_ORIENTACION = re.compile(
    r'^ORIENTACI[OÓ]N\s+(.+)$',
    re.IGNORECASE
)