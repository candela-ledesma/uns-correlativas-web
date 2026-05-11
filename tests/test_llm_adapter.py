# DEPRECATED: pendiente de borrar (junto con core/llm/)
import unittest

from core.llm.adapter import adaptar, _adaptar_correlativas, _normalizar_anio_llm


class TestAdaptarCorrelativas(unittest.TestCase):
    def test_ids_validos(self):
        result = _adaptar_correlativas(["1234", "5678"])
        self.assertEqual(result, {
            "1234": {"para_cursar": None, "para_rendir": None},
            "5678": {"para_cursar": None, "para_rendir": None},
        })

    def test_descarta_nulls(self):
        result = _adaptar_correlativas([None, "1234", None])
        self.assertNotIn(None, result)
        self.assertIn("1234", result)

    def test_descarta_strings_vacios(self):
        result = _adaptar_correlativas(["", "  ", "5000"])
        self.assertEqual(list(result.keys()), ["5000"])

    def test_no_es_lista_devuelve_vacio(self):
        self.assertEqual(_adaptar_correlativas(None), {})
        self.assertEqual(_adaptar_correlativas({"1234": "aprobada"}), {})
        self.assertEqual(_adaptar_correlativas("1234"), {})

    def test_lista_vacia(self):
        self.assertEqual(_adaptar_correlativas([]), {})


class TestNormalizarAnioLLM(unittest.TestCase):
    def test_primer_anio(self):
        self.assertEqual(_normalizar_anio_llm("Primer Año"), "Primer Año")
        self.assertEqual(_normalizar_anio_llm("PRIMER AÑO"), "Primer Año")

    def test_segundo_anio(self):
        self.assertEqual(_normalizar_anio_llm("Segundo Año"), "Segundo Año")

    def test_valor_crudo_desconocido(self):
        result = _normalizar_anio_llm("Año Introductorio")
        self.assertIsNotNone(result)

    def test_null_input(self):
        self.assertIsNone(_normalizar_anio_llm(None))
        self.assertIsNone(_normalizar_anio_llm(""))
        self.assertIsNone(_normalizar_anio_llm("   "))

    def test_no_string(self):
        self.assertIsNone(_normalizar_anio_llm(1))
        self.assertIsNone(_normalizar_anio_llm([]))


class TestAdaptar(unittest.TestCase):
    def _plan_data_minimo(self):
        return {
            "plan": {"carrera": "Ingeniería Civil", "duracion": "Plan 2020"},
            "materias": [
                {
                    "id": "1001",
                    "nombre": "ALGEBRA",
                    "anio": "Primer Año",
                    "correlativas": [],
                }
            ],
        }

    def test_campos_plan(self):
        result = adaptar(self._plan_data_minimo())
        self.assertEqual(result["plan"]["carrera"], "Ingeniería Civil")
        self.assertEqual(result["plan"]["codigo_plan"], "Plan 2020")
        self.assertIsNone(result["plan"]["universidad"])

    def test_campos_materia_defaults(self):
        result = adaptar(self._plan_data_minimo())
        m = result["materias"][0]
        self.assertEqual(m["id"], "1001")
        self.assertEqual(m["nombre"], "ALGEBRA")
        self.assertEqual(m["año"], "Primer Año")
        self.assertIsNone(m["cuatrimestre"])
        self.assertEqual(m["horas"], "")
        self.assertEqual(m["tipo"], "materia")
        self.assertEqual(m["categoria"], "normal")
        self.assertIsNone(m["grupo_opcion"])
        self.assertIsNone(m["subtipo"])

    def test_agrupadores_vacio(self):
        result = adaptar(self._plan_data_minimo())
        self.assertEqual(result["agrupadores"], [])

    def test_correlativas_se_adaptan(self):
        plan_data = self._plan_data_minimo()
        plan_data["materias"][0]["correlativas"] = ["9001", None, "9002"]
        result = adaptar(plan_data)
        cors = result["materias"][0]["correlativas"]
        self.assertIn("9001", cors)
        self.assertIn("9002", cors)
        self.assertNotIn(None, cors)
        self.assertEqual(cors["9001"], {"para_cursar": None, "para_rendir": None})

    def test_warnings_se_incluyen(self):
        result = adaptar(self._plan_data_minimo(), warnings=["algo raro en materia 2"])
        self.assertIn("_warnings", result)
        self.assertEqual(result["_warnings"], ["algo raro en materia 2"])

    def test_sin_warnings_no_incluye_clave(self):
        result = adaptar(self._plan_data_minimo(), warnings=[])
        self.assertNotIn("_warnings", result)

    def test_materias_con_id_null(self):
        plan_data = {
            "plan": {"carrera": "Test", "duracion": None},
            "materias": [{"id": None, "nombre": "MATERIA SIN ID", "anio": None, "correlativas": []}],
        }
        result = adaptar(plan_data)
        self.assertIsNone(result["materias"][0]["id"])

    def test_plan_carrera_null(self):
        plan_data = {
            "plan": {"carrera": None, "duracion": None},
            "materias": [],
        }
        result = adaptar(plan_data)
        self.assertIsNone(result["plan"]["carrera"])
        self.assertIsNone(result["plan"]["codigo_plan"])
        self.assertIsNone(result["plan"]["universidad"])

    def test_item_no_dict_se_ignora(self):
        plan_data = {
            "plan": {"carrera": "Test", "duracion": None},
            "materias": ["texto_raro", {"id": "1", "nombre": "OK", "anio": None, "correlativas": []}],
        }
        result = adaptar(plan_data)
        self.assertEqual(len(result["materias"]), 1)
        self.assertEqual(result["materias"][0]["id"], "1")


if __name__ == "__main__":
    unittest.main()
