# DEPRECATED: pendiente de borrar (junto con core/llm/)
import unittest

from core.llm.sanity_check import (
    LLMStructureError,
    PreLLMSanityError,
    SanityResult,
    calcular_confidence,
    check_estructura_minima,
    check_plandata,
    check_texto,
)

TEXTO_VALIDO = (
    "PRIMER AÑO\nPrimer Cuatrimestre\n1234 ALGEBRA 128 hs.\n"
    "Aprobada Cursada\n5678 ANALISIS 96 hs.\n" * 5
)


class TestCheckTexto(unittest.TestCase):
    def test_texto_valido_pasa(self):
        result = check_texto(TEXTO_VALIDO)
        self.assertTrue(result.ok)

    def test_texto_vacio_falla(self):
        with self.assertRaises(PreLLMSanityError):
            check_texto("")

    def test_texto_corto_falla(self):
        with self.assertRaises(PreLLMSanityError):
            check_texto("hola mundo")

    def test_sin_ids_falla(self):
        texto = "Este es un texto académico con CUATRIMESTRE y AÑO pero sin identificadores." * 5
        with self.assertRaises(PreLLMSanityError):
            check_texto(texto)

    def test_sin_palabras_clave_falla(self):
        texto = "1234 5678 9012 3456 7890 1234 5678 9012 3456 texto sin académico relevante..." * 5
        with self.assertRaises(PreLLMSanityError):
            check_texto(texto)

    def test_no_string_falla(self):
        with self.assertRaises(PreLLMSanityError):
            check_texto(None)  # type: ignore


class TestCheckEstructuraMinima(unittest.TestCase):
    def test_estructura_valida(self):
        data = {"plan": {"carrera": "Test"}, "materias": [{"id": "1"}]}
        result = check_estructura_minima(data)
        self.assertTrue(result.ok)

    def test_no_dict_lanza_error(self):
        with self.assertRaises(LLMStructureError):
            check_estructura_minima([])
        with self.assertRaises(LLMStructureError):
            check_estructura_minima("string")
        with self.assertRaises(LLMStructureError):
            check_estructura_minima(None)

    def test_plan_no_dict_lanza_error(self):
        with self.assertRaises(LLMStructureError):
            check_estructura_minima({"plan": None, "materias": [{"id": "1"}]})

    def test_materias_no_lista_lanza_error(self):
        with self.assertRaises(LLMStructureError):
            check_estructura_minima({"plan": {}, "materias": {}})

    def test_materias_vacia_lanza_error(self):
        with self.assertRaises(LLMStructureError):
            check_estructura_minima({"plan": {}, "materias": []})


class TestCheckPlandata(unittest.TestCase):
    def _plan_data(self, n=10, ids_nulos=0, nombres_nulos=0, correlativas_como_dict=False):
        materias = []
        for i in range(n):
            m = {
                "id": None if i < ids_nulos else str(1000 + i),
                "nombre": None if i < nombres_nulos else f"MATERIA {i}",
                "anio": "Primer Año",
                "correlativas": {} if correlativas_como_dict else [],
            }
            materias.append(m)
        return {"plan": {"carrera": "Test"}, "materias": materias}

    def test_plan_data_valido(self):
        result = check_plandata(self._plan_data())
        self.assertTrue(result.ok)

    def test_sin_materias_falla(self):
        result = check_plandata({"plan": {}, "materias": []})
        self.assertFalse(result.ok)

    def test_demasiados_ids_nulos_falla(self):
        # 4/10 = 40% > 30%
        result = check_plandata(self._plan_data(n=10, ids_nulos=4))
        self.assertFalse(result.ok)
        self.assertTrue(any("ID" in e for e in result.errors))

    def test_limite_ids_nulos_ok(self):
        # 3/10 = 30% — exactamente en el límite, no debe fallar
        result = check_plandata(self._plan_data(n=10, ids_nulos=3))
        self.assertTrue(result.ok)

    def test_demasiados_nombres_nulos_falla(self):
        # 6/10 = 60% > 50%
        result = check_plandata(self._plan_data(n=10, nombres_nulos=6))
        self.assertFalse(result.ok)

    def test_correlativas_como_dict_agrega_error(self):
        result = check_plandata(self._plan_data(correlativas_como_dict=True))
        self.assertFalse(result.ok)
        self.assertTrue(any("dict" in e or "lista" in e for e in result.errors))

    def test_materia_sin_id_ni_nombre_agrega_warning(self):
        plan_data = {
            "plan": {"carrera": "Test"},
            "materias": [{"id": None, "nombre": None, "correlativas": []}],
        }
        result = check_plandata(plan_data)
        # No llega al 30% porque es 1/1 = 100% ids nulos → error
        self.assertFalse(result.ok)


class TestCalcularConfidence(unittest.TestCase):
    def test_todo_completo(self):
        plan_data = {
            "plan": {"carrera": "Test"},
            "materias": [
                {"id": "1", "nombre": "A"},
                {"id": "2", "nombre": "B"},
            ],
        }
        score = calcular_confidence(plan_data)
        self.assertAlmostEqual(score, 1.0)

    def test_sin_ids(self):
        plan_data = {
            "plan": {"carrera": "Test"},
            "materias": [
                {"id": None, "nombre": "A"},
                {"id": None, "nombre": "B"},
            ],
        }
        score = calcular_confidence(plan_data)
        # 0 ids * 0.5 + 1 nombres * 0.3 + 1 carrera * 0.2 = 0.5
        self.assertAlmostEqual(score, 0.5)

    def test_sin_materias(self):
        self.assertEqual(calcular_confidence({"plan": {}, "materias": []}), 0.0)

    def test_sin_carrera(self):
        plan_data = {
            "plan": {},
            "materias": [{"id": "1", "nombre": "A"}],
        }
        score = calcular_confidence(plan_data)
        # 1 * 0.5 + 1 * 0.3 + 0 * 0.2 = 0.8
        self.assertAlmostEqual(score, 0.8)


if __name__ == "__main__":
    unittest.main()
