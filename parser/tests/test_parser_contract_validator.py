import unittest

from core.parser.contract_validator import validate_plan_contract


class ParserContractValidatorTests(unittest.TestCase):
    def test_valid_payload_passes(self):
        payload = {
            "plan": {
                "carrera": "Arquitectura",
                "universidad": "Universidad Nacional del Sur",
                "codigo_plan": "Plan 2016",
            },
            "materias": [
                {
                    "id": "1001",
                    "nombre": "MATERIA A",
                    "año": "Primer Año",
                    "cuatrimestre": "Primer Cuatrimestre",
                    "horas": "64",
                    "tipo": "materia",
                    "categoria": "normal",
                    "grupo_opcion": None,
                    "orientaciones": ["Construcciones", "Vías de Comunicación"],
                    "subtipo": None,
                    "correlativas": {},
                }
            ],
            "agrupadores": [],
        }

        result = validate_plan_contract(payload)

        self.assertTrue(result.is_valid)
        self.assertEqual(result.errors, [])

    def test_invalid_payload_reports_errors(self):
        payload = {
            "plan": {
                "carrera": "",
                "universidad": "Universidad Nacional del Sur",
                "codigo_plan": "",
            },
            "materias": [
                {
                    "id": "1001",
                    "nombre": "",
                    "año": "",
                    "cuatrimestre": "Primer Cuatrimestre",
                    "horas": "",
                    "tipo": "materia",
                    "categoria": "otro",
                    "grupo_opcion": 10,
                    "orientaciones": ["Construcciones", 42],
                    "subtipo": None,
                    "correlativas": {
                        "9999": {
                            "para_cursar": "regular",
                            "para_rendir": "aprobada",
                        }
                    },
                }
            ],
            "agrupadores": "invalid",
        }

        result = validate_plan_contract(payload)

        self.assertFalse(result.is_valid)
        self.assertGreater(len(result.errors), 0)


if __name__ == "__main__":
    unittest.main()
