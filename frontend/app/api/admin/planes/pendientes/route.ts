import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/authz";
import { getPendingPlans } from "@/lib/db/planRepository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const rows = await getPendingPlans();

  const planes = rows.map((row) => {
    let plan: unknown = null;
    try { plan = JSON.parse(row.planJson); } catch {}
    return { slug: row.slug, plan, size: row.planJson.length, mtime: row.updatedAt.toISOString() };
  });

  return NextResponse.json({ planes });
}
