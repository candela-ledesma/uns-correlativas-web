import unittest

from core.parser.cli import _uns_a_plandata


class TestUnsAPlandata(unittest.TestCase):
    def _resultado_regex_base(self):
        return {
            "plan": {
                "carrera": "Licenciatura en Computación",
                "universidad": "Universidad Nacional del Sur",
                "codigo_plan": "Plan 2009",
            },
            "materias": [
                {
                    "id": "5912",
                    "nombre": "ALGEBRA",
                    "año": "Primer Año",
                    "cuatrimestre": "Primer Cuatrimestre",
                    "horas": "128",
                    "tipo": "materia",
                    "categoria": "normal",
                    "grupo_opcion": None,
                    "subtipo": None,
                    "correlativas": {
                        "5793": {"para_cursar": "cursada", "para_rendir": "aprobada"},
                        "5794": {"para_cursar": None, "para_rendir": "aprobada"},
                    },
                },
                {
                    "id": "5793",
                    "nombre": "ANALISIS",
                    "año": "Primer Año",
                    "cuatrimestre": "Segundo Cuatrimestre",
                    "horas": "96",
                    "tipo": "materia",
                    "categoria": "normal",
                    "grupo_opcion": None,
                    "subtipo": None,
                    "correlativas": {},
                },
            ],
            "agrupadores": [],
        }

    def test_plan_campos(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        self.assertEqual(result["plan"]["carrera"], "Licenciatura en Computación")
        self.assertEqual(result["plan"]["duracion"], "Plan 2009")

    def test_plan_universidad_no_se_incluye(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        self.assertNotIn("universidad", result["plan"])

    def test_materias_cantidad(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        self.assertEqual(len(result["materias"]), 2)

    def test_materia_campos_basicos(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        m = result["materias"][0]
        self.assertEqual(m["id"], "5912")
        self.assertEqual(m["nombre"], "ALGEBRA")
        self.assertEqual(m["anio"], "Primer Año")

    def test_correlativas_dict_a_lista_de_ids(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        cors = result["materias"][0]["correlativas"]
        self.assertIsInstance(cors, list)
        self.assertIn("5793", cors)
        self.assertIn("5794", cors)

    def test_correlativas_vacias_devuelve_lista_vacia(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        cors = result["materias"][1]["correlativas"]
        self.assertEqual(cors, [])

    def test_anio_mapeado_desde_campo_con_tilde(self):
        resultado = {
            "plan": {"carrera": "Test", "codigo_plan": None},
            "materias": [
                {"id": "1", "nombre": "M", "año": "Segundo Año", "correlativas": {}}
            ],
            "agrupadores": [],
        }
        result = _uns_a_plandata(resultado)
        self.assertEqual(result["materias"][0]["anio"], "Segundo Año")

    def test_campos_extras_ignorados(self):
        result = _uns_a_plandata(self._resultado_regex_base())
        m = result["materias"][0]
        self.assertNotIn("cuatrimestre", m)
        self.assertNotIn("horas", m)
        self.assertNotIn("tipo", m)
        self.assertNotIn("categoria", m)

    def test_materia_sin_correlativas_key(self):
        resultado = {
            "plan": {"carrera": "Test", "codigo_plan": None},
            "materias": [{"id": "1", "nombre": "M", "año": None}],
            "agrupadores": [],
        }
        result = _uns_a_plandata(resultado)
        self.assertEqual(result["materias"][0]["correlativas"], [])

    def test_materias_vacia(self):
        resultado = {
            "plan": {"carrera": "Test", "codigo_plan": None},
            "materias": [],
            "agrupadores": [],
        }
        result = _uns_a_plandata(resultado)
        self.assertEqual(result["materias"], [])

    def test_item_no_dict_ignorado(self):
        resultado = {
            "plan": {"carrera": "Test", "codigo_plan": None},
            "materias": ["basura", {"id": "1", "nombre": "OK", "año": None, "correlativas": {}}],
            "agrupadores": [],
        }
        result = _uns_a_plandata(resultado)
        self.assertEqual(len(result["materias"]), 1)

    def test_plan_null(self):
        resultado = {"plan": None, "materias": [], "agrupadores": []}
        result = _uns_a_plandata(resultado)
        self.assertIsNone(result["plan"]["carrera"])
        self.assertIsNone(result["plan"]["duracion"])

    def test_preserva_nulls_de_regex(self):
        resultado = {
            "plan": {"carrera": None, "codigo_plan": None},
            "materias": [{"id": None, "nombre": None, "año": None, "correlativas": {}}],
            "agrupadores": [],
        }
        result = _uns_a_plandata(resultado)
        self.assertIsNone(result["materias"][0]["id"])
        self.assertIsNone(result["materias"][0]["nombre"])
        self.assertIsNone(result["materias"][0]["anio"])


if __name__ == "__main__":
    unittest.main()
