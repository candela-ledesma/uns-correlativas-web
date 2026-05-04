from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / "web" / ".env.local")

from core.parser.cli import main


if __name__ == "__main__":
	raise SystemExit(main())
