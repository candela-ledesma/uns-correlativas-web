import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from core.parser import cli


class ParserCliTests(unittest.TestCase):
    def test_main_generates_json_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_path = Path(tmp_dir)
            pdf_path = base_path / "plan.pdf"
            output_path = base_path / "out" / "plan.json"
            pdf_path.write_bytes(b"%PDF-1.7")

            payload = {
                "plan": {
                    "carrera": "Arquitectura",
                    "universidad": "Universidad Nacional del Sur",
                    "codigo_plan": "Plan 2016 - Version 2",
                },
                "materias": [],
                "agrupadores": [],
            }

            with patch("core.parser.cli.parsear_plan_pdf", return_value=payload):
                exit_code = cli.main([str(pdf_path), str(output_path)])

            self.assertEqual(exit_code, 0)
            self.assertTrue(output_path.exists())

            with output_path.open("r", encoding="utf-8") as output_file:
                result = json.load(output_file)

            self.assertEqual(result, payload)

    def test_main_returns_error_when_pdf_not_found(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            base_path = Path(tmp_dir)
            missing_pdf = base_path / "missing.pdf"
            output_path = base_path / "result.json"

            exit_code = cli.main([str(missing_pdf), str(output_path)])

            self.assertEqual(exit_code, 1)
            self.assertFalse(output_path.exists())


if __name__ == "__main__":
    unittest.main()
