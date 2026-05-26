import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSessionSummary } from "@/lib/db/userProductContext";

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const summary = await getUserSessionSummary(session.user.id);

  return NextResponse.json(summary);
}
