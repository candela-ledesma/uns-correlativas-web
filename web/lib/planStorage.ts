import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getDefaultVersionForCarrera } from "@/lib/carreras";

const STORAGE_KEY_PREFIX = "estadoMaterias";
const LEGACY_STORAGE_KEY = "estadoMaterias";

function getStorageKey(planId: string, versionId: string) {
    return `${STORAGE_KEY_PREFIX}::${planId}::${versionId}`;
}

export function loadPlanState(
    planId: string,
    versionId: string
): Record<string, EstadoMateria> {
    if (typeof window === "undefined") return {};

        const key = getStorageKey(planId, versionId);
        const saved = localStorage.getItem(key);

        if (!saved) {
        const defaultVersion = getDefaultVersionForCarrera(planId)?.versionId ?? null;

        if (defaultVersion && defaultVersion === versionId) {
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
                try {
                    const parsed = JSON.parse(legacy);
                    localStorage.setItem(key, JSON.stringify(parsed));
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                    return parsed;
                } catch {
                    return {};
                }
            }
        }

        return {};
        }

    try {
    return JSON.parse(saved);
    } catch {
    return {};
    }
    }

export function savePlanState(
    planId: string,
    versionId: string,
    estados: Record<string, EstadoMateria>
) {
if (typeof window === "undefined") return;

localStorage.setItem(getStorageKey(planId, versionId), JSON.stringify(estados));
}

export function clearPlanState(planId: string, versionId: string) {
if (typeof window === "undefined") return;

localStorage.removeItem(getStorageKey(planId, versionId));
}