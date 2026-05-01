import unittest

from core.llm.gemini_normalizer import LLMParseError, _extraer_json


PLAN_DATA_VALIDO = {
    "plan": {"carrera": "Ingeniería Civil", "duracion": "5 años"},
    "materias": [
        {"id": "1001", "nombre": "ALGEBRA", "anio": "Primer Año", "correlativas": []}
    ],
}

JSON_VALIDO = '{"plan": {"carrera": "Ingeniería Civil", "duracion": "5 años"}, "materias": [{"id": "1001", "nombre": "ALGEBRA", "anio": "Primer Año", "correlativas": []}]}'


class TestExtraerJson(unittest.TestCase):
    def test_json_directo(self):
        result = _extraer_json(JSON_VALIDO)
        self.assertEqual(result["plan"]["carrera"], "Ingeniería Civil")

    def test_json_en_bloque_markdown(self):
        texto = f"```json\n{JSON_VALIDO}\n```"
        result = _extraer_json(texto)
        self.assertEqual(result["plan"]["carrera"], "Ingeniería Civil")

    def test_json_en_bloque_markdown_mayusculas(self):
        texto = f"```JSON\n{JSON_VALIDO}\n```"
        result = _extraer_json(texto)
        self.assertIn("plan", result)

    def test_json_con_texto_antes_y_despues(self):
        texto = f"Aquí está el resultado:\n\n{JSON_VALIDO}\n\nEspero que sea útil."
        result = _extraer_json(texto)
        self.assertIn("plan", result)

    def test_json_con_solo_llaves(self):
        texto = f"Texto previo {JSON_VALIDO} texto posterior"
        result = _extraer_json(texto)
        self.assertIn("plan", result)

    def test_json_invalido_lanza_error(self):
        with self.assertRaises(LLMParseError):
            _extraer_json("esto no es json para nada")

    def test_json_incompleto_lanza_error(self):
        with self.assertRaises(LLMParseError):
            _extraer_json('{"plan": {"carrera": ')

    def test_texto_vacio_lanza_error(self):
        with self.assertRaises(LLMParseError):
            _extraer_json("")

    def test_bloque_markdown_con_json_invalido_intenta_extraccion(self):
        # Bloque markdown con JSON roto → intenta fallback con {}
        with self.assertRaises(LLMParseError):
            _extraer_json("```json\n{sin cerrar\n```")

    def test_json_con_array_raiz_no_es_plan_data(self):
        # Devuelve el array como está (el sanity check lo rechazará después)
        result = _extraer_json("[1, 2, 3]")
        self.assertEqual(result, [1, 2, 3])

    def test_preserva_unicode(self):
        json_unicode = '{"plan": {"carrera": "Ingeniería", "duracion": null}, "materias": []}'
        result = _extraer_json(json_unicode)
        self.assertEqual(result["plan"]["carrera"], "Ingeniería")

    def test_bloque_markdown_con_espacios_extra(self):
        texto = "```json\n\n  " + JSON_VALIDO + "\n\n```"
        result = _extraer_json(texto)
        self.assertIn("materias", result)


if __name__ == "__main__":
    unittest.main()
