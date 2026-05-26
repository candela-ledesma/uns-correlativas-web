import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

export type ProgressState = Record<string, EstadoMateria>;

export type ProgressSnapshot = {
  state: ProgressState;
  updatedAt: string | null;
};

export type ProgressResolution = {
  source: "local" | "remote";
  snapshot: ProgressSnapshot;
};

const VALID_STATES = new Set<EstadoMateria>(["no_cursada", "cursada", "aprobada"]);

function toMillis(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanitizeProgressState(input: unknown): ProgressState {
  if (!input || typeof input !== "object") return {};

  const result: ProgressState = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (typeof value !== "string") continue;
    if (!VALID_STATES.has(value as EstadoMateria)) continue;
    result[key] = value as EstadoMateria;
  }

  return result;
}

export function resolveProgressSnapshotLww(params: {
  local: ProgressSnapshot;
  remote: ProgressSnapshot;
}): ProgressResolution {
  const localMs = toMillis(params.local.updatedAt);
  const remoteMs = toMillis(params.remote.updatedAt);

  if (localMs >= remoteMs) {
    return {
      source: "local",
      snapshot: {
        state: params.local.state,
        updatedAt: params.local.updatedAt,
      },
    };
  }

  return {
    source: "remote",
    snapshot: {
      state: params.remote.state,
      updatedAt: params.remote.updatedAt,
    },
  };
}
