import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { CARRERAS } from "@/lib/data/carreras";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");
const CARRERAS_FILE = path.join(process.cwd(), "lib", "data", "carreras.ts");

async function registrarCarreraEnConfig(
  slug: string,
  jsonFile: string,
  nombre: string,
): Promise<void> {
  const yaRegistrada = CARRERAS.some((c) => c.id === slug);
  if (yaRegistrada) return;

  const source = await fs.readFile(CARRERAS_FILE, "utf-8");

  const newEntry = `
    {
    id: "${slug}" as unknown as CarreraId,
    nombre: "${nombre}",
    descripcion: "Plan de estudios y correlativas.",
    defaultVersionId: "v1",
    versions: [
        {
        versionId: "v1",
        label: "Plan actual",
        jsonFile: "${jsonFile}",
        disponible: true,
        },
    ],
    disponible: true,
    },`;

  // Insertamos antes del cierre del array CARRERAS
  const updated = source.replace(/^(\];)/m, `${newEntry}\n$1`);

  await fs.writeFile(CARRERAS_FILE, updated, "utf-8");
}

type ParseResult = {
  plan: { carrera: string; universidad: string; codigo_plan: string };
  materias: Array<{ id: string; nombre: string }>;
  agrupadores: unknown[];
  [key: string]: unknown;
};

function slugFromPlan(plan: ParseResult["plan"]): string {
  return plan.carrera
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    plan: ParseResult;
    fuente: "gemini" | "parser";
    publicar: boolean;
    resolucion: "reemplazar" | "conservar" | "nueva_version" | null;
    motivo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { plan, fuente, publicar, resolucion, motivo } = body;
  if (!plan?.plan?.carrera) {
    return NextResponse.json({ error: "Datos del plan inválidos" }, { status: 400 });
  }

  const slug = slugFromPlan(plan.plan);
  const isGemini = fuente === "gemini";
  const targetDir = isGemini ? DATA_DIR_GEMINI : DATA_DIR;
  const filePath = path.join(targetDir, `${slug}.json`);

  try {
    if (isGemini) {
      await fs.mkdir(DATA_DIR_GEMINI, { recursive: true });
    }

    const existing = await fs.readFile(filePath, "utf-8").then(JSON.parse).catch(() => null) as ParseResult | null;

    if (existing && !resolucion) {
      const stat = await fs.stat(filePath);
      const diffMs = Date.now() - stat.mtimeMs;
      const diffDays = Math.floor(diffMs / 86400000);
      const fechaLabel = diffDays === 0 ? "hoy" : diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
      return NextResponse.json({
        conflict: true,
        existing: {
          materias: (existing.materias ?? []).length,
          fechaCarga: fechaLabel,
          fuente: String(existing._llm_mode ?? "parser"),
        },
      });
    }

    if (resolucion === "conservar") {
      return NextResponse.json({ ok: true, slug, action: "conserved" });
    }

    const dataToSave = {
      ...plan,
      _saved_at: new Date().toISOString(),
      _saved_by: session.user.id,
      _saved_fuente: fuente,
      _publicado: publicar,
      ...(motivo ? { _motivo_cambio: motivo } : {}),
      ...(resolucion === "nueva_version" ? { _version: "v2" } : {}),
    };

    if (resolucion === "nueva_version" && existing) {
      const backupPath = path.join(targetDir, `${slug}_v1_backup.json`);
      await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), "utf-8");
    }

    await fs.writeFile(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");

    // Solo registrar en carreras.ts si es parser (fuente de verdad)
    if (!isGemini) {
      await registrarCarreraEnConfig(slug, `${slug}.json`, plan.plan.carrera).catch(() => {});
    }

    await createAuditEvent({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "PLAN_SAVED",
      entityType: "plan",
      entityId: slug,
      reason: motivo ?? null,
      after: {
        carrera: plan.plan.carrera,
        universidad: plan.plan.universidad,
        codigo_plan: plan.plan.codigo_plan,
        materias: plan.materias.length,
        fuente,
        publicar,
        resolucion: resolucion ?? "nuevo",
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
