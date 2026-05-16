/**
 * Migración inicial: sube los JSONs de disco (data/local y data/gemini) a la BD.
 *
 * - data/local/*.json  → PlanBorrador(fuente="parser")  + PlanPublicado(fuente="parser")
 * - data/gemini/*.json → PlanBorrador(fuente="gemini")
 *
 * Es idempotente: usa upsert, puede correrse más de una vez sin duplicar datos.
 *
 * Uso: npx tsx scripts/migrate-jsons-to-db.ts
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, "../data");
const LOCAL_DIR = path.join(DATA_DIR, "local");
const GEMINI_DIR = path.join(DATA_DIR, "gemini");

function slugFromFilename(filename: string): string {
  return filename.replace(/\.json$/, "");
}

async function migrateDir(dir: string, fuente: "parser" | "gemini") {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  console.log(`\n[${fuente}] ${files.length} archivos en ${dir}`);

  for (const file of files) {
    const slug = slugFromFilename(file);
    const planJson = fs.readFileSync(path.join(dir, file), "utf-8");

    // Validar que sea JSON válido
    try {
      JSON.parse(planJson);
    } catch {
      console.error(`  ✗ ${slug}: JSON inválido, salteando`);
      continue;
    }

    // Upsert en PlanBorrador
    await prisma.planBorrador.upsert({
      where: { slug_fuente: { slug, fuente } },
      create: { slug, fuente, planJson },
      update: { planJson, updatedAt: new Date() },
    });

    console.log(`  ✓ PlanBorrador [${fuente}] ${slug}`);

    // data/local también va a PlanPublicado como fuente de verdad
    if (fuente === "parser") {
      await prisma.planPublicado.upsert({
        where: { slug },
        create: { slug, fuente: "parser", planJson },
        update: { planJson, fuente: "parser", updatedAt: new Date() },
      });
      console.log(`  ✓ PlanPublicado [parser] ${slug}`);
    }
  }
}

async function main() {
  console.log("=== Migración de JSONs a BD ===");
  console.log("BD:", process.env.DATABASE_URL?.slice(0, 50) + "...");

  await migrateDir(LOCAL_DIR, "parser");
  await migrateDir(GEMINI_DIR, "gemini");

  const borradores = await prisma.planBorrador.count();
  const publicados = await prisma.planPublicado.count();
  console.log(`\n=== Resumen ===`);
  console.log(`PlanBorrador: ${borradores} registros`);
  console.log(`PlanPublicado: ${publicados} registros`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
