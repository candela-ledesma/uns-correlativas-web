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

                self.assertIsInstance(parsed.get("materias"), list)
                self.assertGreater(
                    len(parsed["materias"]),
                    0,
                    f"Parser sin materias para {carrera_id}",
                )

                with reference_json_path.open("r", encoding="utf-8") as reference_file:
                    reference_data = json.load(reference_file)

                reference_count = len(reference_data.get("materias", []))
                expected_minimum = max(10, int(reference_count * 0.6))

                self.assertGreaterEqual(
                    len(parsed["materias"]),
                    expected_minimum,
                    (
                        f"Cantidad de materias muy baja para {carrera_id}. "
                        f"Esperado >= {expected_minimum}, obtenido {len(parsed['materias'])}"
                    ),
                )


if __name__ == "__main__":
    unittest.main()
