import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";
import { createAuditEvent } from "@/lib/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_LOCAL  = path.join(process.cwd(), "data", "local");
const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");
const CARRERAS_FILE   = path.join(process.cwd(), "lib", "data", "carreras.ts");

type Params = { params: Promise<{ slug: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return null;
  return session;
}

function jsonFilesFor(slug: string) {
  return {
    local:  path.join(DATA_DIR_LOCAL,  `${slug}.json`),
    gemini: path.join(DATA_DIR_GEMINI, `${slug}.json`),
  };
}

// ── GET: devuelve el JSON completo del plan publicado ─────────────────────────
export async function GET(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { local, gemini } = jsonFilesFor(slug);

  const filePath = await fs.access(local).then(() => local).catch(() => gemini);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return new Response(raw, { headers: { "Content-Type": "application/json; charset=utf-8" } });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}

// ── PUT: reemplaza el JSON publicado con el body recibido ─────────────────────
export async function PUT(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { local, gemini } = jsonFilesFor(slug);

  let newJson: string;
  try {
    const body = await req.text();
    JSON.parse(body); // valida que sea JSON válido antes de escribir
    newJson = body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const filePath = await fs.access(local).then(() => local).catch(() => gemini);
  try {
    await fs.writeFile(filePath, newJson, "utf-8");
  } catch {
    return NextResponse.json({ error: "No se pudo escribir el archivo" }, { status: 500 });
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_EDITED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}

// ── PATCH: cambia disponible en carreras.ts ───────────────────────────────────
export async function PATCH(req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { disponible }: { disponible: boolean } = await req.json();

  const source = await fs.readFile(CARRERAS_FILE, "utf-8").catch(() => null);
  if (!source) return NextResponse.json({ error: "No se pudo leer carreras.ts" }, { status: 500 });

  // Extrae el bloque de la carrera (desde id: "slug" hasta el }, de cierre)
  // y reemplaza el `disponible:` que aparece DESPUÉS del cierre de versions ([],)
  // para no tocar los disponible: de las versiones individuales.
  const blockRegex = new RegExp(
    `(id:\\s*["']${slug}["'][\\s\\S]*?\\n    \\},?)`,
    "m"
  );
  const blockMatch = source.match(blockRegex);
  if (!blockMatch) {
    return NextResponse.json({ error: "No se encontró la carrera en carreras.ts" }, { status: 404 });
  }
  const block = blockMatch[0];

  // Operar solo en el fragmento después del cierre de versions (último ],)
  const versionsClose = block.lastIndexOf("],");
  if (versionsClose === -1) {
    return NextResponse.json({ error: "Estructura inesperada en carreras.ts" }, { status: 500 });
  }
  const beforeVersions = block.slice(0, versionsClose + 2);
  const afterVersions  = block.slice(versionsClose + 2).replace(
    /(disponible:\s*)(true|false)/,
    `$1${disponible}`
  );
  const updatedBlock = beforeVersions + afterVersions;

  if (updatedBlock === block) {
    return NextResponse.json({ error: "No se pudo modificar disponible en carreras.ts" }, { status: 500 });
  }

  const updated = source.replace(block, updatedBlock);

  await fs.writeFile(CARRERAS_FILE, updated, "utf-8");

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: disponible ? "PLAN_ENABLED" : "PLAN_DISABLED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: { disponible },
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug, disponible });
}

// ── DELETE: borra el JSON y desregistra de carreras.ts ───────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const { local, gemini } = jsonFilesFor(slug);

  // Borrar archivos (local y gemini si existen)
  await Promise.all([
    fs.unlink(local).catch(() => {}),
    fs.unlink(gemini).catch(() => {}),
  ]);

  // Desregistrar de carreras.ts — elimina el bloque completo de la carrera
  const source = await fs.readFile(CARRERAS_FILE, "utf-8").catch(() => null);
  if (source) {
    // Elimina el bloque que empieza con { y contiene id: "slug", hasta el },
    const updated = source.replace(
      new RegExp(`\\s*\\{[^{}]*id:\\s*["']${slug}["'][\\s\\S]*?\\},?`, "m"),
      ""
    );
    await fs.writeFile(CARRERAS_FILE, updated, "utf-8");
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    actorRole: session.user.role,
    action: "PLAN_DELETED",
    entityType: "plan",
    entityId: slug,
    reason: null,
    after: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug });
}
