import unittest

from core.parser.cleaner import recomponer_lineas_partidas


class RecomponerLineasPartidasTests(unittest.TestCase):
    """Tests for Caso 3: split subject names across two PDF lines."""

    def test_caso3_junta_continuacion_nombre(self):
        """Línea con nombre partido en dos debe unirse."""
        texto = (
            "9167 PROCEDIMIENTO ADMINISTRATIVO Y CONTROL JUDICIAL DE LA\n"
            "ADMINISTRACION PUBLICA 64hs. 9007 Cursada Cursada"
        )
        resultado = recomponer_lineas_partidas(texto)
        self.assertEqual(
            resultado,
            "9167 PROCEDIMIENTO ADMINISTRATIVO Y CONTROL JUDICIAL DE LA "
            "ADMINISTRACION PUBLICA 64hs. 9007 Cursada Cursada",
        )

    def test_caso3_junta_continuacion_nombre_sin_horas(self):
        """Continuación de nombre sin horas ni correlativas (e.g. 1681)."""
        texto = (
            "1681 ACTUACION PROFESIONAL EN CONTEXTOS DE TECNOLOGIA DE LA\n"
            "INFORMACION\n"
            "1558 Aprobada Aprobada"
        )
        resultado = recomponer_lineas_partidas(texto)
        lineas = resultado.splitlines()
        self.assertEqual(
            lineas[0],
            "1681 ACTUACION PROFESIONAL EN CONTEXTOS DE TECNOLOGIA DE LA INFORMACION",
        )

    def test_caso3_no_absorbe_anio(self):
        """Encabezado de año NO debe ser absorbido como continuación de nombre."""
        texto = (
            "9020 FILOSOFIA DEL DERECHO 64hs. 9001 Aprobada Aprobada\n"
            "SEGUNDO AÑO\n"
            "9021 OTRA MATERIA 32hs."
        )
        resultado = recomponer_lineas_partidas(texto)
        lineas = resultado.splitlines()
        self.assertIn("SEGUNDO AÑO", lineas)
        self.assertTrue(lineas[0].startswith("9020 "))
        # El encabezado debe quedar como línea separada, no pegado a 9020
        self.assertNotIn("SEGUNDO AÑO", lineas[0])

    def test_caso3_no_absorbe_materias_optativas(self):
        """MATERIAS OPTATIVAS NO debe ser absorbido como continuación de nombre."""
        texto = (
            "9141 TRABAJO DE INVESTIGACION FINAL 0hs. 9115 Aprobada Aprobada\n"
            "MATERIAS OPTATIVAS\n"
            "G2347 Optativa de Abogacía, plan 2020"
        )
        resultado = recomponer_lineas_partidas(texto)
        lineas = resultado.splitlines()
        self.assertIn("MATERIAS OPTATIVAS", lineas)
        self.assertNotIn("MATERIAS OPTATIVAS", lineas[0])

    def test_caso3_no_absorbe_orientacion(self):
        """Encabezado ORIENTACIÓN NO debe ser absorbido como continuación de nombre."""
        texto = (
            "I0012 Aprobada Aprobada\n"
            "ORIENTACIÓN HIDRÁULICA\n"
            "5220 HIDRAULICA GENERAL 64hs."
        )
        resultado = recomponer_lineas_partidas(texto)
        lineas = resultado.splitlines()
        self.assertIn("ORIENTACIÓN HIDRÁULICA", lineas)
        self.assertNotIn("ORIENTACIÓN HIDRÁULICA", lineas[0])


if __name__ == "__main__":
    unittest.main()
