#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";
import {
  formatBatchValidationReport,
  validateConfiguredPlanData,
} from "@/lib/data/dataValidationBatch";

type OutputFormat = "human" | "json" | "both";

type CliOptions = {
  strictWarnings: boolean;
  includeHidden: boolean;
  includeUnavailable: boolean;
  format: OutputFormat;
  jsonOut: string | null;
  dataDir: string | null;
};

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    strictWarnings: false,
    includeHidden: false,
    includeUnavailable: false,
    format: "human",
    jsonOut: null,
    dataDir: null,
  };

  for (const arg of args) {
    if (arg === "--strict") {
      options.strictWarnings = true;
      continue;
    }

    if (arg === "--include-hidden") {
      options.includeHidden = true;
      continue;
    }

    if (arg === "--include-unavailable") {
      options.includeUnavailable = true;
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value === "human" || value === "json" || value === "both") {
        options.format = value;
        continue;
      }

      throw new Error("Valor invalido para --format. Usar: human|json|both");
    }

    if (arg.startsWith("--json-out=")) {
      options.jsonOut = arg.slice("--json-out=".length);
      continue;
    }

    if (arg.startsWith("--data-dir=")) {
      options.dataDir = arg.slice("--data-dir=".length);
      continue;
    }

    throw new Error(`Argumento desconocido: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("Uso: npm run validate:data -- [opciones]");
  console.log("");
  console.log("Opciones:");
  console.log("  --strict                Falla tambien con warnings");
  console.log("  --include-hidden        Incluye versiones ocultas");
  console.log("  --include-unavailable   Incluye versiones no disponibles");
  console.log("  --format=human|json|both");
  console.log("  --json-out=<ruta>       Escribe reporte JSON en un archivo");
  console.log("  --data-dir=<ruta>       Directorio de datos alternativo");
  console.log("  --help                  Muestra esta ayuda");
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    const report = await validateConfiguredPlanData({
      strictWarnings: options.strictWarnings,
      includeHidden: options.includeHidden,
      includeUnavailable: options.includeUnavailable,
      dataDir: options.dataDir ? path.resolve(options.dataDir) : undefined,
    });

    if (options.format === "human" || options.format === "both") {
      console.log(formatBatchValidationReport(report));
    }

    if (options.format === "json" || options.format === "both") {
      console.log(JSON.stringify(report, null, 2));
    }

    if (options.jsonOut) {
      const target = path.resolve(options.jsonOut);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, JSON.stringify(report, null, 2), "utf8");
      console.log(`Reporte JSON guardado en ${target}`);
    }

    process.exit(report.shouldFail ? 1 : 0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`validate:data error: ${message}`);
    process.exit(1);
  }
}

void main();
