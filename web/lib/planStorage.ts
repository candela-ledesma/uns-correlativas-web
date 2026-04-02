import { EstadoMateria } from "@/lib/evaluarCorrelativas";

const STORAGE_KEY = "estadoMaterias";

export function loadPlanState(): Record<string, EstadoMateria> {
    if (typeof window === "undefined") return {};

    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return {};

    try {
    return JSON.parse(saved);
    } catch {
    return {};
    }
    }

export function savePlanState(estados: Record<string, EstadoMateria>) {
if (typeof window === "undefined") return;

localStorage.setItem(STORAGE_KEY, JSON.stringify(estados));
}

export function clearPlanState() {
if (typeof window === "undefined") return;

localStorage.removeItem(STORAGE_KEY);
}