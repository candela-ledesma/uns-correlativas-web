/**
 * Migración de datos: puebla PlanVersion con todos los (planId, versionId) distintos
 * que existen en UserPlanProgress, UserRecentPlan, ScheduleBlock y ProgressShare,
 * y luego actualiza planVersionId en cada tabla con el id correspondiente.
 *
 * Es idempotente: usa upsert en PlanVersion y solo actualiza filas con planVersionId = null.
 *
 * Uso: npx tsx scripts/migrate-plan-versions.ts
 */

import * as path from "path";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const prisma = new PrismaClient();

async function collectPairs(): Promise<Map<string, string>> {
  // Recoge todos los (planId, versionId) distintos de las 4 tablas
  const [progress, recent, schedule, shares] = await Promise.all([
    prisma.userPlanProgress.findMany({ select: { planId: true, versionId: true }, distinct: ["planId", "versionId"] }),
    prisma.userRecentPlan.findMany({ select: { planId: true, versionId: true }, distinct: ["planId", "versionId"] }),
    prisma.scheduleBlock.findMany({ select: { planId: true, versionId: true }, distinct: ["planId", "versionId"] }),
    prisma.progressShare.findMany({ select: { planId: true, versionId: true }, distinct: ["planId", "versionId"] }),
  ]);

  const all = [...progress, ...recent, ...schedule, ...shares];
  const seen = new Map<string, string>(); // key -> planVersionId (se llena después del upsert)

  for (const row of all) {
    const key = `${row.planId}::${row.versionId}`;
    if (!seen.has(key)) seen.set(key, "");
  }

  return seen;
}

async function upsertPlanVersions(pairs: Map<string, string>): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const key of pairs.keys()) {
    const [planSlug, versionId] = key.split("::");
    const row = await prisma.planVersion.upsert({
      where: { planSlug_versionId: { planSlug, versionId } },
      update: {},
      create: { planSlug, versionId },
    });
    result.set(key, row.id);
    console.log(`  ✓ PlanVersion ${planSlug}/${versionId} → ${row.id}`);
  }

  return result;
}

async function backfillTable(
  versionMap: Map<string, string>,
  tableName: "userPlanProgress" | "userRecentPlan" | "scheduleBlock" | "progressShare"
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = (prisma as any)[tableName];

  const rows = await table.findMany({
    where: { planVersionId: null },
    select: { id: true, planId: true, versionId: true },
  });

  console.log(`\n[${tableName}] ${rows.length} filas sin planVersionId`);

  for (const row of rows) {
    const key = `${row.planId}::${row.versionId}`;
    const planVersionId = versionMap.get(key);
    if (!planVersionId) {
      console.warn(`  ⚠ No se encontró PlanVersion para ${key}`);
      continue;
    }
    await table.update({ where: { id: row.id }, data: { planVersionId } });
    console.log(`  ✓ ${row.id} → ${planVersionId}`);
  }
}

async function main() {
  console.log("=== Migración PlanVersion backfill ===");
  console.log("BD:", process.env.DATABASE_URL?.slice(0, 50) + "...");

  console.log("\n[1] Recolectando pares (planId, versionId)...");
  const pairs = await collectPairs();
  console.log(`  ${pairs.size} pares únicos encontrados`);

  console.log("\n[2] Upsert en PlanVersion...");
  const versionMap = await upsertPlanVersions(pairs);

  console.log("\n[3] Backfill de planVersionId en tablas de usuario...");
  await backfillTable(versionMap, "userPlanProgress");
  await backfillTable(versionMap, "userRecentPlan");
  await backfillTable(versionMap, "scheduleBlock");
  await backfillTable(versionMap, "progressShare");

  const total = await prisma.planVersion.count();
  console.log(`\n=== Resumen ===`);
  console.log(`PlanVersion: ${total} registros`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
