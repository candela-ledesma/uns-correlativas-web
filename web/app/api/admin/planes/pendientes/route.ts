import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import path from "path";
import fs from "fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR_GEMINI = path.join(process.cwd(), "data", "gemini");

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const files = await fs.readdir(DATA_DIR_GEMINI).catch(() => [] as string[]);
    const pendingFiles = files.filter((f) => f.endsWith("_pendiente.json"));

    const planes = await Promise.all(
      pendingFiles.map(async (file) => {
        const filePath = path.join(DATA_DIR_GEMINI, file);
        const raw = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(raw);
        const stat = await fs.stat(filePath);
        return {
          slug: file.replace("_pendiente.json", ""),
          file,
          plan: data,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        };
      })
    );

    return NextResponse.json({ planes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
