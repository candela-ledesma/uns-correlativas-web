import unittest

from core.parser.correlativa_prosa import inferir_correlativa_en_prosa, inferir_requisito_especial


class InferirCorrelativaEnProsa(unittest.TestCase):

    # Caso exacto de materia 5464 en el PDF de Agrimensura.
    # La línea en prosa contiene "5175 Aprobada" y palabras clave de correlativa.
    def test_5464_agrimensura_infiere_correlativa(self):
        linea = (
            'Para aprobar Para iniciar la "Práctica Profesional Supervisada" '
            'se deberá tener como 5175 Aprobada'
        )
        ids_conocidos = {"5175", "5464", "5469", "5482", "5485"}

        correlativas, warnings = inferir_correlativa_en_prosa(linea, ids_conocidos)

        self.assertIn("5175", correlativas)
        self.assertEqual(len(warnings), 1)
        self.assertIn("5175", warnings[0])

    def test_linea_sin_palabras_clave_no_infiere(self):
        # Sin palabras clave de correlativa → no debe inferir
        linea = "mínimo 26 materias del plan aprobadas."
        ids_conocidos = {"5175", "5464"}

        correlativas, warnings = inferir_correlativa_en_prosa(linea, ids_conocidos)

        self.assertEqual(correlativas, {})
        self.assertEqual(warnings, [])

    def test_ambiguedad_dos_ids_emite_warning_sin_inferir(self):
        linea = "Para cursar tener aprobado 5175 o rendir 5482"
        ids_conocidos = {"5175", "5482", "5464"}

        correlativas, warnings = inferir_correlativa_en_prosa(linea, ids_conocidos)

        self.assertEqual(correlativas, {})
        self.assertEqual(len(warnings), 1)
        self.assertIn("ambig", warnings[0].lower())

    def test_id_desconocido_no_infiere(self):
        # 9999 no está en ids_conocidos → no debe inferir
        linea = "Para cursar tener aprobado 9999"
        ids_conocidos = {"5175", "5464"}

        correlativas, warnings = inferir_correlativa_en_prosa(linea, ids_conocidos)

        self.assertEqual(correlativas, {})
        self.assertEqual(warnings, [])


class InferirRequisitoEspecialTests(unittest.TestCase):

    def test_minimo_materias_simple(self):
        r = inferir_requisito_especial("al menos 26 materias del plan aprobadas.")
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "minimo_materias_aprobadas")
        self.assertEqual(r[0]["cantidad"], 26)

    def test_minimo_materias_con_cgcb_para_cursar(self):
        # Caso ing-electrónica: minimo + CGCB con "para cursar el 3o año"
        linea = "Debe tener al menos 12 materias aprobadas y tener aprobado el CGCB para cursar el 3o año"
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 2)
        self.assertEqual(r[0]["tipo"], "minimo_materias_aprobadas")
        self.assertEqual(r[0]["cantidad"], 12)
        self.assertEqual(r[1]["tipo"], "cgcb_aprobado")

    def test_minimo_materias_con_cgcb_antes_de_comenzar(self):
        linea = "al menos 12 materias aprobadas y tener aprobado el CGCB antes de comenzar a cursar el tercer año"
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 2)
        self.assertEqual(r[0]["tipo"], "minimo_materias_aprobadas")
        self.assertEqual(r[0]["cantidad"], 12)
        self.assertEqual(r[1]["tipo"], "cgcb_aprobado")

    def test_cgcb_solo_para_cursar(self):
        linea = "tener aprobado el CGCB para cursar el 3o año"
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "cgcb_aprobado")

    def test_anio_aprobado_simple(self):
        r = inferir_requisito_especial("tercer año aprobado")
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "anio_aprobado")
        self.assertEqual(r[0]["anio"], 3)

    def test_minimo_examenes_finales_para_cursar(self):
        # Caso exacto del profesorado en filosofía, materia 4844
        linea = "Para cursar Se requiere haber aprobado 16 exámenes finales de las materias disciplinares."
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "minimo_examenes_finales")
        self.assertEqual(r[0]["cantidad"], 16)

    def test_minimo_examenes_finales_para_aprobar(self):
        linea = "Para aprobar Se requiere haber aprobado 16 exámenes finales de las materias disciplinares."
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "minimo_examenes_finales")
        self.assertEqual(r[0]["cantidad"], 16)

    def test_minimo_examenes_finales_sin_haber(self):
        linea = "aprobado 8 exámenes finales"
        r = inferir_requisito_especial(linea)
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["tipo"], "minimo_examenes_finales")
        self.assertEqual(r[0]["cantidad"], 8)


if __name__ == "__main__":
    unittest.main()
