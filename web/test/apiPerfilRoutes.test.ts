import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import {
  getUserProductContext,
  recordPlanOpened,
  updateOnboardingState,
  updateUserCareerContext,
} from "@/lib/userProductContext";
import {
  GET as getContext,
  PUT as putContext,
} from "@/app/api/perfil/contexto/route";
import {
  GET as getOnboarding,
  POST as postOnboarding,
} from "@/app/api/perfil/onboarding/route";
import { POST as postPlanVisit } from "@/app/api/perfil/plan-visit/route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/userProductContext", () => ({
  getUserProductContext: vi.fn(),
  updateUserCareerContext: vi.fn(),
  updateOnboardingState: vi.fn(),
  recordPlanOpened: vi.fn(),
}));

const baseContext = {
  careers: [
    {
      id: "arquitectura",
      nombre: "Arquitectura",
      descripcion: "Plan de estudios y correlativas.",
    },
  ],
  enrolledCareerIds: ["arquitectura"],
  activeCareerId: "arquitectura",
  onboardingCompletedAt: null,
  onboardingDismissedAt: null,
  shouldAutoShowOnboarding: true,
  lastPlanByCareer: {},
  recentActivity: [],
};

describe("/api/perfil routes", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@uns.local",
        role: "USER",
      },
    } as never);

    vi.mocked(getUserProductContext).mockResolvedValue(baseContext as never);
    vi.mocked(updateUserCareerContext).mockResolvedValue(baseContext as never);
    vi.mocked(updateOnboardingState).mockResolvedValue(baseContext as never);
    vi.mocked(recordPlanOpened).mockResolvedValue(baseContext as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /api/perfil/contexto retorna contexto autenticado", async () => {
    const response = await getContext();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activeCareerId).toBe("arquitectura");
    expect(getUserProductContext).toHaveBeenCalledWith("user-1");
  });

  it("PUT /api/perfil/contexto actualiza carrera activa", async () => {
    const response = await putContext(
      new Request("http://localhost/api/perfil/contexto", {
        method: "PUT",
        body: JSON.stringify({
          enrolledCareerIds: ["arquitectura"],
          activeCareerId: "arquitectura",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateUserCareerContext).toHaveBeenCalled();
  });

  it("GET /api/perfil/onboarding expone estado", async () => {
    const response = await getOnboarding();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.shouldAutoShowOnboarding).toBe(true);
  });

  it("POST /api/perfil/onboarding actualiza estado", async () => {
    const response = await postOnboarding(
      new Request("http://localhost/api/perfil/onboarding", {
        method: "POST",
        body: JSON.stringify({
          action: "dismiss",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(updateOnboardingState).toHaveBeenCalledWith({
      userId: "user-1",
      action: "dismiss",
    });
  });

  it("POST /api/perfil/plan-visit registra apertura de plan", async () => {
    const response = await postPlanVisit(
      new Request("http://localhost/api/perfil/plan-visit", {
        method: "POST",
        body: JSON.stringify({
          careerId: "arquitectura",
          planId: "arquitectura",
          versionId: "v2",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(recordPlanOpened).toHaveBeenCalledWith({
      userId: "user-1",
      careerId: "arquitectura",
      planId: "arquitectura",
      versionId: "v2",
    });
  });

  it("responde 401 sin sesion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await getContext();

    expect(response.status).toBe(401);
  });
});
