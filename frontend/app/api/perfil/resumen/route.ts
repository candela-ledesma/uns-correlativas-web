import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/authz";
import { getUserSessionSummary } from "@/lib/db/userProductContext";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const summary = await getUserSessionSummary(session.user.id);

  return NextResponse.json(summary);
}
