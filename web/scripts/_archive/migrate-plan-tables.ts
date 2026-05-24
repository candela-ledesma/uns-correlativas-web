/**
 * Migración de datos: copia PlanBorrador, PlanPendiente y PlanPublicado → tabla Plan.
 *
 * Es idempotente: usa upsert sobre (slug, fuente, estado), puede correrse más de una vez.
 * Las tablas originales NO se eliminan — eso ocurre en un paso posterior una vez verificado.
 *
 * Mapeo:
 *   PlanBorrador  (fuente: "parser"|"gemini") → Plan(estado=BORRADOR, fuente=PARSER|GEMINI)
 *   PlanPendiente (fuente dentro de planJson._fuente) → Plan(estado=PENDIENTE)
 *   PlanPublicado (fuente: "parser"|"gemini", slug termina en "_v1_backup"?) → Plan(estado=PUBLICADO, esBackup)
 *
 * Uso: npx tsx scripts/migrate-plan-tables.ts
 */

import * as path from "path";
import { PrismaClient, PlanEstado, PlanFuente } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const prisma = new PrismaClient();

function parseFuente(raw: string): PlanFuente {
  if (raw === "parser") return PlanFuente.PARSER;
  if (raw === "gemini") return PlanFuente.GEMINI;
  console.warn(`  ⚠ fuente desconocida "${raw}", usando PARSER como fallback`);
  return PlanFuente.PARSER;
}

async function migrateBorradores() {
  const rows = await prisma.planBorrador.findMany();
  console.log(`\n[BORRADOR] ${rows.length} registros`);

  for (const row of rows) {
    const fuente = parseFuente(row.fuente);
    await prisma.plan.upsert({
      where: { slug_fuente_estado: { slug: row.slug, fuente, estado: PlanEstado.BORRADOR } },
      create: {
        slug: row.slug,
        estado: PlanEstado.BORRADOR,
        fuente,
        planJson: row.planJson,
        autorId: row.createdBy ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        planJson: row.planJson,
        autorId: row.createdBy ?? null,
        updatedAt: row.updatedAt,
      },
    });
    console.log(`  ✓ BORRADOR [${row.fuente}] ${row.slug}`);
  }
}

async function migratePendientes() {
  const rows = await prisma.planPendiente.findMany();
  console.log(`\n[PENDIENTE] ${rows.length} registros`);

  for (const row of rows) {
    // fuente no es columna en PlanPendiente — está dentro del planJson como _fuente
    let fuenteRaw = "gemini";
    try {
      const parsed = JSON.parse(row.planJson) as Record<string, unknown>;
      if (typeof parsed._fuente === "string") fuenteRaw = parsed._fuente;
    } catch {
      // planJson inválido, usamos gemini como fallback
    }
    const fuente = parseFuente(fuenteRaw);

    await prisma.plan.upsert({
      where: { slug_fuente_estado: { slug: row.slug, fuente, estado: PlanEstado.PENDIENTE } },
      create: {
        slug: row.slug,
        estado: PlanEstado.PENDIENTE,
        fuente,
        planJson: row.planJson,
        autorId: row.submittedBy ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      update: {
        planJson: row.planJson,
        autorId: row.submittedBy ?? null,
        updatedAt: row.updatedAt,
      },
    });
    console.log(`  ✓ PENDIENTE [${fuenteRaw}] ${row.slug}`);
  }
}

async function migratePublicados() {
  const rows = await prisma.planPublicado.findMany();
  console.log(`\n[PUBLICADO] ${rows.length} registros`);

  for (const row of rows) {
    const fuente = parseFuente(row.fuente);
    // Los slugs que terminan en "_v1_backup" son copias de seguridad del plan anterior
    const esBackup = row.slug.endsWith("_v1_backup");
    // Para backups el slug real es sin el sufijo, el estado sigue siendo PUBLICADO
    const slugNormalizado = esBackup ? row.slug.replace(/_v1_backup$/, "") : row.slug;

    await prisma.plan.upsert({
      where: { slug_fuente_estado: { slug: row.slug, fuente, estado: PlanEstado.PUBLICADO } },
      create: {
        slug: slugNormalizado,
        estado: PlanEstado.PUBLICADO,
        fuente,
        planJson: row.planJson,
        publicado: row.publicado,
        esBackup,
        autorId: row.savedBy ?? null,
        createdAt: row.savedAt,
        updatedAt: row.updatedAt,
      },
      update: {
        planJson: row.planJson,
        publicado: row.publicado,
        autorId: row.savedBy ?? null,
        updatedAt: row.updatedAt,
      },
    });
    console.log(`  ✓ PUBLICADO [${row.fuente}]${esBackup ? " [backup]" : ""} ${row.slug}`);
  }
}

async function main() {
  console.log("=== Migración Plan tables → Plan ===");
  console.log("BD:", process.env.DATABASE_URL?.slice(0, 50) + "...");

  await migrateBorradores();
  await migratePendientes();
  await migratePublicados();

  const total = await prisma.plan.count();
  const porEstado = await prisma.plan.groupBy({ by: ["estado"], _count: true });
  console.log(`\n=== Resumen ===`);
  console.log(`Plan total: ${total} registros`);
  for (const g of porEstado) {
    console.log(`  ${g.estado}: ${g._count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
