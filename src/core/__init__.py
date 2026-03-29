import json
from src.core.correlativas import simular_aprobar

with open("data/arquitectura.json") as f:
    materias = json.load(f)

aprobadas = {8118}
cursadas = {5489}

desbloqueadas = simular_aprobar(
    materias,
    aprobadas,
    cursadas,
    5488
)

for m in desbloqueadas:
    print(m["nombre"])