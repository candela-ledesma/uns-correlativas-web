"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TEXT, TEXT_SEC, SURFACE, BTN, BTN_RED as BTN_RED_BASE, INPUT, TITLE_SHADOW, GLASS } from "@/lib/ui/tokens";
const BTN_RED = { ...BTN_RED_BASE, borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer" } as const;

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
    onShare?: () => void;
    shareStatus?: "idle" | "loading" | "copied" | "error";
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

export default function PlanHeader({
    titulo, subtitulo, aprobadas, cursadas, disponibles, total,
    onReset, onShare, shareStatus = "idle", versionSelector,
}: Props) {
    const [mostrarProgreso,  setMostrarProgreso]  = useState(false);
    const [confirmingReset,  setConfirmingReset]  = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const visibleVersionOptions = versionSelector
        ? versionSelector.options.filter((o) => o.hidden !== true)
        : [];
    const availableVisible = visibleVersionOptions.filter((o) => o.disponible !== false);
    const showVersionSelector = Boolean(versionSelector && availableVisible.length > 1);
    const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

    useEffect(() => {
        if (!confirmingReset) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmingReset(false); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [confirmingReset]);

    function updateVersion(versionId: string) {
        if (!versionSelector || versionId === versionSelector.selectedVersionId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("v", versionId);
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    }

    return (
        <header style={{ marginBottom: 36, display: "grid", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, minWidth: 0, maxWidth: "100%" }}>
                <div style={{ minWidth: 0, maxWidth: "100%" }}>
                    <h1 style={{ color: TEXT, fontSize: "clamp(1.6rem,4vw,3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8, textShadow: TITLE_SHADOW, wordBreak: "break-word" }}>
                        {titulo}
                    </h1>
                    {subtitulo && <p style={{ color: TEXT_SEC, fontSize: 14, margin: 0, wordBreak: "break-word" }}>{subtitulo}</p>}
                </div>

                <div data-no-print style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0, maxWidth: "100%" }}>
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

                    {onShare && (
                        <button
                            type="button"
                            onClick={onShare}
                            disabled={shareStatus === "loading"}
                            style={{
                                background: "transparent",
                                border: `1px solid ${GLASS.border}`,
                                color: shareStatus === "copied" ? "#90be6d" : shareStatus === "error" ? "#f87171" : TEXT_SEC,
                                borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 500,
                                cursor: shareStatus === "loading" ? "not-allowed" : "pointer",
                                opacity: shareStatus === "loading" ? 0.6 : 1,
                                transition: "color 0.2s",
                            }}
                        >
                            {shareStatus === "loading" ? "Generando…" : shareStatus === "copied" ? "✓ Link copiado" : shareStatus === "error" ? "Error al compartir" : "Compartir progreso"}
                        </button>
                    )}

                    {onReset && (
                        <button
                            type="button"
                            data-testid="reset-btn"
                            onClick={() => setConfirmingReset(true)}
                            style={{ background: "transparent", border: `1px solid ${GLASS.border}`, color: TEXT_SEC, borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                        >
                            Reiniciar progreso
                        </button>
                    )}

                    <button
                        type="button"
                        data-testid="toggle-progreso-btn"
                        aria-expanded={mostrarProgreso}
                        onClick={() => setMostrarProgreso((p) => !p)}
                        style={{ ...BTN, borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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

            {/* Reset confirmation modal */}
            {confirmingReset && onReset && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reset-modal-title"
                    style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,0.55)",
                        backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: 24,
                    }}
                    onClick={() => setConfirmingReset(false)}
                >
                    <div
                        style={{
                            background: "rgba(18,12,36,0.97)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 20,
                            padding: "24px 20px",
                            maxWidth: 400,
                            width: "100%",
                            backdropFilter: "blur(24px)",
                            boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
                            display: "grid",
                            gap: 20,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div>
                            <h2 id="reset-modal-title" style={{ color: TEXT, fontSize: 17, fontWeight: 800, margin: "0 0 10px" }}>
                                Reiniciar progreso
                            </h2>
                            <p style={{ color: TEXT_SEC, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                                ¿Seguro que querés reiniciar tu progreso? Esta acción no se puede deshacer.
                            </p>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConfirmingReset(false)}
                                style={{ ...BTN, borderRadius: 10, padding: "10px 18px", cursor: "pointer" }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                data-testid="reset-confirm-btn"
                                onClick={() => { setConfirmingReset(false); onReset(); }}
                                style={BTN_RED}
                            >
                                Sí, reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
