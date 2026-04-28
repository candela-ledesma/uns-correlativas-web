import unittest

from core.parser.correlativa_prosa import inferir_correlativa_en_prosa


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


if __name__ == "__main__":
    unittest.main()
