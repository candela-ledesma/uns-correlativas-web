import { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";

const STORAGE_KEY_PREFIX = "estadoMaterias";
const LEGACY_STORAGE_KEY = "estadoMaterias";
const STORAGE_META_KEY_PREFIX = "estadoMateriasMeta";
const STORAGE_MIGRATION_KEY_PREFIX = "estadoMateriasMigrado";

function getStorageKey(carreraSlug: string, versionId: string) {
    return `${STORAGE_KEY_PREFIX}::${carreraSlug}::${versionId}`;
}

function getMetaStorageKey(carreraSlug: string, versionId: string) {
    return `${STORAGE_META_KEY_PREFIX}::${carreraSlug}::${versionId}`;
}

function getMigrationKey(userId: string, carreraSlug: string, versionId: string) {
    return `${STORAGE_MIGRATION_KEY_PREFIX}::${userId}::${carreraSlug}::${versionId}`;
}

export type LocalPlanSnapshot = {
    estados: Record<string, EstadoMateria>;
    updatedAt: string | null;
};

function loadSnapshotUpdatedAt(carreraSlug: string, versionId: string) {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(getMetaStorageKey(carreraSlug, versionId));
    if (!raw) return null;

    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function saveSnapshotUpdatedAt(carreraSlug: string, versionId: string, updatedAtIso?: string) {
    if (typeof window === "undefined") return;

    const value = updatedAtIso ?? new Date().toISOString();
    localStorage.setItem(getMetaStorageKey(carreraSlug, versionId), value);
}

function clearSnapshotUpdatedAt(carreraSlug: string, versionId: string) {
    if (typeof window === "undefined") return;

    localStorage.removeItem(getMetaStorageKey(carreraSlug, versionId));
}

export function loadPlanState(
    carreraSlug: string,
    versionId: string
): Record<string, EstadoMateria> {
    if (typeof window === "undefined") return {};

    const key = getStorageKey(carreraSlug, versionId);
    const saved = localStorage.getItem(key);

    if (!saved) {
        // Migra datos de localStorage legacy solo para la versión "v1" (default histórico).
        if (versionId === "v1") {
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
    carreraSlug: string,
    versionId: string
): LocalPlanSnapshot {
    return {
        estados: loadPlanState(carreraSlug, versionId),
        updatedAt: loadSnapshotUpdatedAt(carreraSlug, versionId),
    };
}

export function savePlanState(
    carreraSlug: string,
    versionId: string,
    estados: Record<string, EstadoMateria>,
    updatedAtIso?: string
) {
    if (typeof window === "undefined") return;

    localStorage.setItem(getStorageKey(carreraSlug, versionId), JSON.stringify(estados));
    saveSnapshotUpdatedAt(carreraSlug, versionId, updatedAtIso);
}

export function clearPlanState(carreraSlug: string, versionId: string) {
    if (typeof window === "undefined") return;

    localStorage.removeItem(getStorageKey(carreraSlug, versionId));
    clearSnapshotUpdatedAt(carreraSlug, versionId);
}

export function hasMigratedPlanState(
    userId: string,
    carreraSlug: string,
    versionId: string
) {
    if (typeof window === "undefined") return false;

    return localStorage.getItem(getMigrationKey(userId, carreraSlug, versionId)) === "1";
}

export function markPlanStateMigrated(
    userId: string,
    carreraSlug: string,
    versionId: string
) {
    if (typeof window === "undefined") return;

    localStorage.setItem(getMigrationKey(userId, carreraSlug, versionId), "1");
}
