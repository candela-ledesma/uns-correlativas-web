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

# Texto donde el agrupador aparece primero en el plan normal (con año/cuatrimestre)
# y luego en la sección de optativas — caso real de abogacia G2347-G2350.
TEXTO_COLISION_CON_UBICACION = """\
Carrera con Optativas. (Plan 2020)
CUARTO AÑO
Primer Cuatrimestre
9020 FILOSOFIA DEL DERECHO 64hs.
G2347 Optativa de Abogacia, plan 2020
Segundo Cuatrimestre
9022 DERECHO INTERNACIONAL 64hs.
G2348 Optativa de Abogacia, plan 2020
MATERIAS OPTATIVAS
G2347 Optativa de Abogacia, plan 2020
9014 MATERIA OPTATIVA A
9082 MATERIA OPTATIVA B
G2348 Optativa de Abogacia, plan 2020
9014 MATERIA OPTATIVA A
9082 MATERIA OPTATIVA B
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


class ColisionPreservaUbicacionTests(unittest.TestCase):

    def setUp(self):
        self.resultado = detectar_materias_generico(TEXTO_COLISION_CON_UBICACION)

    def test_agrupador_tiene_anio(self):
        """G2347 debe tener año=Cuarto Año copiado de su aparición en el plan normal."""
        agr = next((a for a in self.resultado["agrupadores"] if a["id"] == "G2347"), None)
        self.assertIsNotNone(agr)
        self.assertEqual(agr.get("año"), "Cuarto Año")

    def test_agrupador_tiene_cuatrimestre(self):
        """G2347 debe tener cuatrimestre=Primer Cuatrimestre."""
        agr = next((a for a in self.resultado["agrupadores"] if a["id"] == "G2347"), None)
        self.assertIsNotNone(agr)
        self.assertEqual(agr.get("cuatrimestre"), "Primer Cuatrimestre")

    def test_agrupador_segundo_cuatri_tiene_ubicacion(self):
        """G2348 debe tener cuatrimestre=Segundo Cuatrimestre."""
        agr = next((a for a in self.resultado["agrupadores"] if a["id"] == "G2348"), None)
        self.assertIsNotNone(agr)
        self.assertEqual(agr.get("año"), "Cuarto Año")
        self.assertEqual(agr.get("cuatrimestre"), "Segundo Cuatrimestre")

    def test_agrupador_no_en_materias(self):
        """G2347 no debe aparecer en materias[]."""
        ids = [str(m["id"]) for m in self.resultado["materias"]]
        self.assertNotIn("G2347", ids)


if __name__ == "__main__":
    unittest.main()
