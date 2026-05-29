import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getUserProductContext, updateOnboardingState } from "@/lib/db/userProductContext";

const onboardingActionSchema = z.object({
  action: z.enum(["dismiss", "complete", "reset"]),
});

function unauthorized() {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const context = await getUserProductContext(session.user.id);

  return NextResponse.json({
    onboardingCompletedAt: context.onboardingCompletedAt,
    onboardingDismissedAt: context.onboardingDismissedAt,
    shouldAutoShowOnboarding: context.shouldAutoShowOnboarding,
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const context = await updateOnboardingState({
    userId: session.user.id,
    action: parsed.data.action,
  });

  return NextResponse.json({
    onboardingCompletedAt: context.onboardingCompletedAt,
    onboardingDismissedAt: context.onboardingDismissedAt,
    shouldAutoShowOnboarding: context.shouldAutoShowOnboarding,
  });
}
