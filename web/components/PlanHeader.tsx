"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TEXT, TEXT_SEC, SURFACE, BTN, INPUT, TITLE_SHADOW } from "@/lib/tokens";

type VersionOption = {
    versionId: string;
    label: string;
    disponible?: boolean;
    hidden?: boolean;
};

type VersionSelectorConfig = {
    selectedVersionId: string;
    defaultVersionId: string;
    options: VersionOption[];
};

type Props = {
    titulo: string;
    subtitulo?: string;
    aprobadas: number;
    cursadas: number;
    disponibles: number;
    total: number;
    onReset?: () => void;
    syncStatus?: "guest" | "syncing" | "synced" | "error";
    versionSelector?: VersionSelectorConfig;
};

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <div style={{ ...SURFACE, minWidth: 120, borderRadius: 14, padding: "12px 16px" }}>
            <div style={{ color: TEXT_SEC, fontSize: 13, marginBottom: 6 }}>{label}</div>
            <div style={{ color: TEXT, fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{value}</div>
        </div>
    );
}

function SyncBadge({ syncStatus }: { syncStatus?: "guest" | "syncing" | "synced" | "error" }) {
    if (!syncStatus) return null;

    const styles: Record<string, React.CSSProperties> = {
        guest:   { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: TEXT_SEC },
        syncing: { background: "rgba(249,199,79,0.12)",  border: "1px solid rgba(249,199,79,0.35)",  color: "#f9c74f" },
        synced:  { background: "rgba(144,190,109,0.12)", border: "1px solid rgba(144,190,109,0.35)", color: "#90be6d" },
        error:   { background: "rgba(231,111,81,0.12)",  border: "1px solid rgba(231,111,81,0.35)",  color: "#e76f51" },
    };
    const labels: Record<string, string> = {
        guest: "Guardado local", syncing: "Sincronizando...",
        synced: "Sincronizado en nube", error: "Error de sincronizacion",
    };

    return (
        <span style={{ ...styles[syncStatus], borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 500 }}>
            {labels[syncStatus]}
        </span>
    );
}

export default function PlanHeader({
    titulo, subtitulo, aprobadas, cursadas, disponibles, total,
    onReset, syncStatus, versionSelector,
}: Props) {
    const [mostrarProgreso, setMostrarProgreso] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const visibleVersionOptions = versionSelector
        ? versionSelector.options.filter((o) => o.hidden !== true)
        : [];
    const availableVisible = visibleVersionOptions.filter((o) => o.disponible !== false);
    const showVersionSelector = Boolean(versionSelector && availableVisible.length > 1);
    const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

    function updateVersion(versionId: string) {
        if (!versionSelector || versionId === versionSelector.selectedVersionId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("v", versionId);
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    }

    return (
        <header style={{ marginBottom: 36, display: "grid", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                    <h1 style={{ color: TEXT, fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8, textShadow: TITLE_SHADOW }}>
                        {titulo}
                    </h1>
                    {subtitulo && <p style={{ color: TEXT_SEC, fontSize: 15, margin: 0 }}>{subtitulo}</p>}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    <SyncBadge syncStatus={syncStatus} />

                    {showVersionSelector && versionSelector && (
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, ...SURFACE, borderRadius: 12, padding: "8px 12px" }}>
                            <span style={{ color: TEXT_SEC, fontSize: 14, fontWeight: 500 }}>Versión</span>
                            <select
                                data-testid="version-selector"
                                value={versionSelector.selectedVersionId}
                                onChange={(e) => updateVersion(e.target.value)}
                                style={{ ...INPUT, borderRadius: 8, padding: "4px 8px", fontSize: 14, fontWeight: 500, outline: "none" }}
                            >
                                {visibleVersionOptions.map((o) => (
                                    <option key={o.versionId} value={o.versionId} disabled={o.disponible === false}>
                                        {o.disponible === false ? `${o.label} (próximamente)` : o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <a
                        href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir easter egg en YouTube"
                        style={{ ...BTN, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 99, fontSize: 14, textDecoration: "none" }}
                    >
                        😬
                    </a>

                    {onReset && (
                        <button
                            type="button"
                            data-testid="reset-btn"
                            onClick={onReset}
                            style={{ ...BTN, borderRadius: 12, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}
                        >
                            Reiniciar progreso
                        </button>
                    )}

                    <button
                        type="button"
                        data-testid="toggle-progreso-btn"
                        aria-expanded={mostrarProgreso}
                        onClick={() => setMostrarProgreso((p) => !p)}
                        style={{ ...BTN, borderRadius: 12, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
                    >
                        {mostrarProgreso ? "Ocultar progreso" : "Mostrar progreso"}
                    </button>
                </div>
            </div>

            {mostrarProgreso && (
                <div style={{ ...SURFACE, borderRadius: 16, padding: 20 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                        <div>
                            <div style={{ color: TEXT_SEC, fontSize: 13, marginBottom: 6 }}>Progreso general</div>
                            <div style={{ color: TEXT, fontSize: 20, fontWeight: 800 }}>{porcentaje}% aprobado</div>
                        </div>
                        <div style={{ color: TEXT_SEC, fontSize: 14 }}>{aprobadas} de {total} materias aprobadas</div>
                    </div>

                    <div aria-hidden="true" style={{ height: 10, width: "100%", borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 20 }}>
                        <div
                            style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #90be6d, #43aa8b)", transition: "width 0.2s", width: `${porcentaje}%` }}
                        />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <StatCard label="Aprobadas" value={aprobadas} />
                        <StatCard label="Cursadas"  value={cursadas}  />
                        <StatCard label="Disponibles" value={disponibles} />
                    </div>
                </div>
            )}
        </header>
    );
}
