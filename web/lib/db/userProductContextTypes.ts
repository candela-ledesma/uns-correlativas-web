export type UserCareerSummary = {
  id: string;
  nombre: string;
  descripcion: string;
};

export type UserLastPlan = {
  planId: string;
  versionId: string;
  openedAt: string;
};

export type UserActivityItem = {
  id: string;
  type:
    | "MATERIA_STATUS_CHANGED"
    | "ACTIVE_CAREER_CHANGED"
    | "PLAN_OPENED"
    | "ONBOARDING_COMPLETED"
    | "ONBOARDING_DISMISSED"
    | "ONBOARDING_RESET";
  careerId: string | null;
  planId: string | null;
  versionId: string | null;
  materiaKey: string | null;
  fromState: string | null;
  toState: string | null;
  metadata: unknown;
  createdAt: string;
};

export type UserProductContextResponse = {
  careers: UserCareerSummary[];
  enrolledCareerIds: string[];
  activeCareerId: string | null;
  onboardingCompletedAt: string | null;
  onboardingDismissedAt: string | null;
  shouldAutoShowOnboarding: boolean;
  lastPlanByCareer: Record<string, UserLastPlan>;
  recentActivity: UserActivityItem[];
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

  return `/planes/${careerId}?${params.toString()}`;
}
