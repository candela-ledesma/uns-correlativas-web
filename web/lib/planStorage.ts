import { EstadoMateria } from "@/lib/evaluarCorrelativas";
import { getDefaultVersionForCarrera } from "@/lib/carreras";

const STORAGE_KEY_PREFIX = "estadoMaterias";
const LEGACY_STORAGE_KEY = "estadoMaterias";
const STORAGE_META_KEY_PREFIX = "estadoMateriasMeta";
const STORAGE_MIGRATION_KEY_PREFIX = "estadoMateriasMigrado";

function getStorageKey(planId: string, versionId: string) {
    return `${STORAGE_KEY_PREFIX}::${planId}::${versionId}`;
}

function getMetaStorageKey(planId: string, versionId: string) {
    return `${STORAGE_META_KEY_PREFIX}::${planId}::${versionId}`;
}

function getMigrationKey(userId: string, planId: string, versionId: string) {
    return `${STORAGE_MIGRATION_KEY_PREFIX}::${userId}::${planId}::${versionId}`;
}

export type LocalPlanSnapshot = {
    estados: Record<string, EstadoMateria>;
    updatedAt: string | null;
};

function loadSnapshotUpdatedAt(planId: string, versionId: string) {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(getMetaStorageKey(planId, versionId));
    if (!raw) return null;

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function saveSnapshotUpdatedAt(planId: string, versionId: string, updatedAtIso?: string) {
    if (typeof window === "undefined") return;

    const value = updatedAtIso ?? new Date().toISOString();
    localStorage.setItem(getMetaStorageKey(planId, versionId), value);
}

function clearSnapshotUpdatedAt(planId: string, versionId: string) {
    if (typeof window === "undefined") return;

    localStorage.removeItem(getMetaStorageKey(planId, versionId));
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

export function loadPlanStateSnapshot(
    planId: string,
    versionId: string
): LocalPlanSnapshot {
    return {
        estados: loadPlanState(planId, versionId),
        updatedAt: loadSnapshotUpdatedAt(planId, versionId),
    };
}

export function savePlanState(
    planId: string,
    versionId: string,
    estados: Record<string, EstadoMateria>,
    updatedAtIso?: string
) {
    if (typeof window === "undefined") return;

    localStorage.setItem(getStorageKey(planId, versionId), JSON.stringify(estados));
    saveSnapshotUpdatedAt(planId, versionId, updatedAtIso);
}

export function clearPlanState(planId: string, versionId: string) {
    if (typeof window === "undefined") return;

    localStorage.removeItem(getStorageKey(planId, versionId));
    clearSnapshotUpdatedAt(planId, versionId);
}

export function hasMigratedPlanState(
    userId: string,
    planId: string,
    versionId: string
) {
    if (typeof window === "undefined") return false;

    return localStorage.getItem(getMigrationKey(userId, planId, versionId)) === "1";
}

export function markPlanStateMigrated(
    userId: string,
    planId: string,
    versionId: string
) {
    if (typeof window === "undefined") return;

    localStorage.setItem(getMigrationKey(userId, planId, versionId), "1");
}
