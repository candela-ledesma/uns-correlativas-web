export type UserCareerSummary = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type UserLastPlan = {
  planSlug: string;
  versionId: string;
  openedAt: string;
};

export type UserProductContextResponse = {
  careers: UserCareerSummary[];
  enrolledCareerIds: string[];
  activeCareerId: string | null;
  onboardingCompletedAt: string | null;
  onboardingDismissedAt: string | null;
  shouldAutoShowOnboarding: boolean;
  lastPlanByCareer: Record<string, UserLastPlan>;
  recentActivity: never[];
  careerIdsWithProgress: string[];
};

export type UserSessionSummaryResponse = {
  activeCareerId: string | null;
  activeCareerName: string | null;
  lastPlanByCareer: Record<string, UserLastPlan>;
};

export function buildPlanHref(careerId: string, plan?: UserLastPlan) {
  if (!plan) {
    return `/planes/${careerId}`;
  }

  const params = new URLSearchParams();
  params.set("v", plan.versionId);

  return `/planes/${plan.planSlug}?${params.toString()}`;
}
