import json
from src.core.correlativas import simular_aprobar

with open("data/arquitectura.json") as f:
    materias = json.load(f)

aprobadas = {}
cursadas = {}

materia_a_simular = 5287 

desbloqueadas = simular_aprobar(
    materias,
    aprobadas,
    cursadas,
    materia_a_simular
)

print("Si apruebo", materia_a_simular, "se desbloquean:\n")

for m in desbloqueadas:
    print(m["nombre"])