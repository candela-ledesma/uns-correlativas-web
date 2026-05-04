import unittest

from core.llm.llm_normalizer import _construir_user_message, PROMPT_VERSION


BASE_JSON = {
    "plan": {"carrera": "Ingeniería Civil", "duracion": None},
    "materias": [
        {"id": "1001", "nombre": "ALGEBRA", "anio": "Primer Año", "correlativas": []}
    ],
}


class TestConstruirUserMessage(unittest.TestCase):
    def test_mode_a_sin_base_json(self):
        msg = _construir_user_message("texto del pdf", None, False)
        self.assertIn("RAW_TEXT:", msg)
        self.assertIn("texto del pdf", msg)
        self.assertIn("OPTIONAL_BASE_JSON:\nnone", msg)
        self.assertIn("ALLOW_OVERWRITE: false", msg)

    def test_mode_b_con_base_json(self):
        msg = _construir_user_message("texto del pdf", BASE_JSON, False)
        self.assertIn("RAW_TEXT:", msg)
        self.assertIn("OPTIONAL_BASE_JSON:", msg)
        self.assertIn("Ingeniería Civil", msg)
        self.assertNotIn("OPTIONAL_BASE_JSON:\nnone", msg)

    def test_allow_overwrite_true(self):
        msg = _construir_user_message("texto", BASE_JSON, True)
        self.assertIn("ALLOW_OVERWRITE: true", msg)

    def test_allow_overwrite_false(self):
        msg = _construir_user_message("texto", None, False)
        self.assertIn("ALLOW_OVERWRITE: false", msg)

    def test_secciones_en_orden(self):
        msg = _construir_user_message("raw text aquí", BASE_JSON, False)
        pos_raw = msg.index("RAW_TEXT:")
        pos_base = msg.index("OPTIONAL_BASE_JSON:")
        pos_ow = msg.index("ALLOW_OVERWRITE:")
        self.assertLess(pos_raw, pos_base)
        self.assertLess(pos_base, pos_ow)

    def test_base_json_serializado_como_json_valido(self):
        import json
        msg = _construir_user_message("texto", BASE_JSON, False)
        # Extraer la parte JSON del mensaje
        inicio = msg.index("OPTIONAL_BASE_JSON:\n") + len("OPTIONAL_BASE_JSON:\n")
        fin = msg.index("\n\nALLOW_OVERWRITE:")
        json_str = msg[inicio:fin]
        parsed = json.loads(json_str)
        self.assertEqual(parsed["plan"]["carrera"], "Ingeniería Civil")

    def test_texto_largo_no_truncado_por_construir(self):
        texto_largo = "A" * 100_000
        msg = _construir_user_message(texto_largo, None, False)
        self.assertIn(texto_largo, msg)

    def test_base_json_none_produce_none_literal(self):
        msg = _construir_user_message("texto", None, False)
        self.assertIn("OPTIONAL_BASE_JSON:\nnone", msg)


class TestPromptVersion(unittest.TestCase):
    def test_version_es_v2(self):
        self.assertEqual(PROMPT_VERSION, "v2")


if __name__ == "__main__":
    unittest.main()
