import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIG_PATH = path.join(process.cwd(), "data", "admin-config.json");

type AdminConfig = {
  systemPrompt: string;
};

async function readConfig(): Promise<AdminConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AdminConfig;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await readConfig();
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { systemPrompt } = body as Partial<AdminConfig>;
  if (typeof systemPrompt !== "string") {
    return NextResponse.json({ error: "Campo requerido: systemPrompt (string)" }, { status: 400 });
  }

  const config: AdminConfig = { systemPrompt: systemPrompt.trim() };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function DELETE(_request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await fs.unlink(CONFIG_PATH);
  } catch {}
  return NextResponse.json({ ok: true });
}
