import unittest

from core.parser.parser_plan import detectar_materias_generico
from core.parser.contract_validator import validate_plan_contract

# Texto que simula un PDF donde G5001 aparece como materia en el plan normal
# (porque el PDF lo imprime en la tabla de materias) y luego como agrupador
# en la sección de optativas.
TEXTO_CON_COLISION = """\
Carrera de Prueba. (Plan 2020)
PRIMER AÑO
Primer Cuatrimestre
1001 ALGEBRA 64hs.
G5001 OPTATIVAS INGENIERIA 0hs.
MATERIAS OPTATIVAS
G5001 OPTATIVAS INGENIERIA
2001 MATERIA OPTATIVA A
2002 MATERIA OPTATIVA B
"""


class IdCollisionTests(unittest.TestCase):
    def setUp(self):
        self.resultado = detectar_materias_generico(TEXTO_CON_COLISION)

    def test_colision_queda_solo_en_agrupadores(self):
        """G5001 no debe aparecer en materias[] cuando ya existe como agrupador."""
        ids_materias = [str(m["id"]) for m in self.resultado["materias"]]
        self.assertNotIn("G5001", ids_materias)

    def test_colision_presente_en_agrupadores(self):
        """G5001 debe estar en agrupadores[]."""
        ids_agrupadores = [str(a["id"]) for a in self.resultado["agrupadores"]]
        self.assertIn("G5001", ids_agrupadores)

    def test_colision_emite_warning_en_contrato(self):
        """validate_plan_contract debe emitir WARNING de colisión ID materia/agrupador."""
        result = validate_plan_contract(self.resultado)
        warning_msgs = [w.message for w in result.warnings]
        self.assertTrue(
            any("G5001" in msg and "colisi" in msg.lower() for msg in warning_msgs),
            f"Se esperaba warning de colisión para G5001, pero warnings fueron: {warning_msgs}",
        )


if __name__ == "__main__":
    unittest.main()
