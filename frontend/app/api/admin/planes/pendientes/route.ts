import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Role } from "@/lib/auth/roles";
import { getPendingPlans } from "@/lib/services/planRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getPendingPlans();

  const planes = rows.map((row) => {
    let plan: unknown = null;
    try { plan = JSON.parse(row.planJson); } catch {}
    return { slug: row.slug, plan, size: row.planJson.length, mtime: row.updatedAt.toISOString() };
  });

  return NextResponse.json({ planes });
}
