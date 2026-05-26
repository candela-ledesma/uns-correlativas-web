import json
import unittest
from pathlib import Path

from core.parser.cli import parsear_plan_pdf
from core.parser.contract_validator import format_contract_issues, validate_plan_contract

BASE_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = BASE_DIR / "pdf"
WEB_DATA_DIR = BASE_DIR / "web" / "data"

FIXTURES = [
    ("arquitectura", PDF_DIR / "arquitectura.pdf", WEB_DATA_DIR / "arquitectura.json"),
    (
        "lic_computacion",
        PDF_DIR / "lic_computacion.pdf",
        WEB_DATA_DIR / "lic_computacion.json",
    ),
    ("bioquimica", PDF_DIR / "bioquimica.pdf", WEB_DATA_DIR / "bioquimica.json"),
    ("ing_civil", PDF_DIR / "ing_civil.pdf", WEB_DATA_DIR / "ing_civil.json"),
]


class ParserCareerFixturesTests(unittest.TestCase):
    @staticmethod
    def _extract_all_materias(parsed_data):
        """Extrae todas las materias del formato nuevo (agrupadas por orientación)."""
        todas = []
        
        # Materias comunes
        if isinstance(parsed_data.get("comunes"), list):
            todas.extend(parsed_data["comunes"])
        
        # Materias en orientaciones
        for key, value in parsed_data.items():
            if key not in ("plan", "agrupadores", "comunes", "materias"):
                if isinstance(value, list):
                    todas.extend(value)
        
        # Si hay "materias" como array (formato antiguo), usarlas
        if isinstance(parsed_data.get("materias"), list):
            todas = parsed_data["materias"]
        
        return todas
    
    @staticmethod
    def _materia_orientaciones(materia):
        orientaciones = []

        orientacion_simple = materia.get("orientacion")
        if isinstance(orientacion_simple, str) and orientacion_simple.strip():
            orientaciones.append(orientacion_simple.strip())

        orientaciones_multiples = materia.get("orientaciones")
        if isinstance(orientaciones_multiples, list):
            for orientacion in orientaciones_multiples:
                if isinstance(orientacion, str) and orientacion.strip() and orientacion not in orientaciones:
                    orientaciones.append(orientacion.strip())

        return set(orientaciones)

    def test_pdf_fixtures_match_contract(self):
        for carrera_id, pdf_path, reference_json_path in FIXTURES:
            with self.subTest(carrera=carrera_id):
                self.assertTrue(pdf_path.exists(), f"No existe fixture PDF: {pdf_path}")
                self.assertTrue(
                    reference_json_path.exists(),
                    f"No existe fixture JSON de referencia: {reference_json_path}",
                )

                parsed = parsear_plan_pdf(pdf_path)
                validation = validate_plan_contract(parsed)

                if validation.errors:
                    self.fail(
                        f"Contrato invalido para {carrera_id}:\n"
                        f"{format_contract_issues(validation.errors)}"
                    )

                # Extraer todas las materias (nuevo formato o antiguo)
                todas_las_materias = self._extract_all_materias(parsed)
                
                self.assertIsInstance(todas_las_materias, list)
                self.assertGreater(
                    len(todas_las_materias),
                    0,
                    f"Parser sin materias para {carrera_id}",
                )

                with reference_json_path.open("r", encoding="utf-8") as reference_file:
                    reference_data = json.load(reference_file)

                reference_count = len(reference_data.get("materias", []))
                expected_minimum = max(10, int(reference_count * 0.6))

                self.assertGreaterEqual(
                    len(todas_las_materias),
                    expected_minimum,
                    (
                        f"Cantidad de materias muy baja para {carrera_id}. "
                        f"Esperado >= {expected_minimum}, obtenido {len(todas_las_materias)}"
                    ),
                )

                if carrera_id == "ing_civil":
                    materias_por_id = {
                        str(materia.get("id")): materia
                        for materia in todas_las_materias
                    }
                    agrupadores_por_id = {
                        str(agrupador.get("id")): agrupador
                        for agrupador in parsed.get("agrupadores", [])
                    }

                    self.assertIn("5013", materias_por_id)
                    self.assertEqual(
                        self._materia_orientaciones(materias_por_id["5013"]),
                        {"Construcciones", "Hidráulica", "Vías de Comunicación"},
                    )
                    self.assertEqual(
                        materias_por_id["5013"].get("ubicacion"),
                        {
                            "Construcciones": {
                                "año": "Quinto Año",
                                "cuatrimestre": "Primer Cuatrimestre",
                            },
                            "Hidráulica": {
                                "año": "Cuarto Año",
                                "cuatrimestre": "Primer Cuatrimestre",
                            },
                            "Vías de Comunicación": {
                                "año": "Quinto Año",
                                "cuatrimestre": "Primer Cuatrimestre",
                            },
                        },
                    )

                    self.assertEqual(
                        self._materia_orientaciones(materias_por_id["5375"]),
                        {"Construcciones", "Hidráulica", "Vías de Comunicación"},
                    )
                    self.assertEqual(
                        self._materia_orientaciones(materias_por_id["5181"]),
                        {"Construcciones", "Hidráulica"},
                    )
                    self.assertEqual(
                        materias_por_id["5181"].get("ubicacion"),
                        {
                            "Construcciones": {
                                "año": "Cuarto Año",
                                "cuatrimestre": "Segundo Cuatrimestre",
                            },
                            "Hidráulica": {
                                "año": "Quinto Año",
                                "cuatrimestre": "Segundo Cuatrimestre",
                            },
                        },
                    )

                    for materia_id in ("5220", "5335", "5115"):
                        with self.subTest(materia=materia_id):
                            self.assertEqual(
                                self._materia_orientaciones(materias_por_id[materia_id]),
                                {"Hidráulica"},
                            )

                    for materia_id in ("5180", "5041", "5042"):
                        with self.subTest(materia=materia_id):
                            self.assertEqual(
                                self._materia_orientaciones(materias_por_id[materia_id]),
                                {"Vías de Comunicación"},
                            )

                    self.assertEqual(
                        materias_por_id["5229"].get("grupo_opcion"),
                        "G0859",
                    )
                    self.assertNotIn(
                        "5229",
                        agrupadores_por_id["G0857"].get("opciones", []),
                    )
                    self.assertIn(
                        "5229",
                        agrupadores_por_id["G0859"].get("opciones", []),
                    )

                    for materia in todas_las_materias:
                        if materia.get("categoria") != "optativa":
                            continue

                        grupo_opcion = materia.get("grupo_opcion")
                        if not isinstance(grupo_opcion, str) or not grupo_opcion.strip():
                            continue

                        materia_id = str(materia.get("id"))
                        self.assertIn(grupo_opcion, agrupadores_por_id)

                        agrupador = agrupadores_por_id[grupo_opcion]
                        self.assertIn(materia_id, agrupador.get("opciones", []))

                        orientaciones_materia = self._materia_orientaciones(materia)
                        orientacion_agrupador = agrupador.get("orientacion")

                        if orientaciones_materia and isinstance(orientacion_agrupador, str):
                            self.assertIn(orientacion_agrupador, orientaciones_materia)

                    for agrupador_id, agrupador in agrupadores_por_id.items():
                        orientacion_agrupador = agrupador.get("orientacion")
                        if not isinstance(orientacion_agrupador, str) or not orientacion_agrupador:
                            continue

                        for opcion_id in agrupador.get("opciones", []):
                            materia = materias_por_id.get(str(opcion_id))
                            if materia is None:
                                continue

                            orientaciones_materia = self._materia_orientaciones(materia)
                            if orientaciones_materia:
                                self.assertIn(
                                    orientacion_agrupador,
                                    orientaciones_materia,
                                    (
                                        "Agrupador con orientación incluye materia de otra "
                                        f"orientación: agrupador={agrupador_id}, materia={opcion_id}"
                                    ),
                                )


if __name__ == "__main__":
    unittest.main()
