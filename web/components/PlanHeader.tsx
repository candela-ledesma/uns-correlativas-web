"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
        <div className="min-w-[120px] rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="mb-1.5 text-sm text-zinc-500">{label}</div>
            <div className="text-2xl font-extrabold leading-none text-zinc-900">{value}</div>
        </div>
    );
}

function SyncBadge({
    syncStatus,
}: {
    syncStatus?: "guest" | "syncing" | "synced" | "error";
}) {
    if (!syncStatus) return null;

    if (syncStatus === "guest") {
        return (
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                Guardado local
            </span>
        );
    }

    if (syncStatus === "syncing") {
        return (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Sincronizando...
            </span>
        );
    }

    if (syncStatus === "error") {
        return (
            <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Error de sincronizacion
            </span>
        );
    }

    return (
        <span className="rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            Sincronizado en nube
        </span>
    );
}

export default function PlanHeader({
    titulo,
    subtitulo,
    aprobadas,
    cursadas,
    disponibles,
    total,
    onReset,
    syncStatus,
    versionSelector,
}: Props) {
    const [mostrarProgreso, setMostrarProgreso] = useState(false);
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const visibleVersionOptions = versionSelector
        ? versionSelector.options.filter((option) => option.hidden !== true)
        : [];

    const availableVisibleVersions = visibleVersionOptions.filter(
        (option) => option.disponible !== false
    );

    const showVersionSelector = Boolean(
        versionSelector && availableVisibleVersions.length > 1
    );

    const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;
    const callbackUrl = pathname || "/";

    function updateVersion(versionId: string) {
        if (!versionSelector) return;
        if (versionId === versionSelector.selectedVersionId) return;

        const params = new URLSearchParams(searchParams.toString());
        params.set("v", versionId);

        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    }

    return (
        <header className="mb-9 grid gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="mb-2 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-tight text-zinc-900">
                        {titulo}
                    </h1>

                    {subtitulo && <p className="m-0 text-base text-zinc-600">{subtitulo}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <SyncBadge syncStatus={syncStatus} />

                    {status === "authenticated" && session.user ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">
                            <span>{session.user.email}</span>
                            <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-semibold">
                                {session.user.role}
                            </span>
                            <Link href="/perfil" className="font-semibold text-zinc-900 underline">
                                Perfil
                            </Link>
                            {session.user.role === "MODERATOR" || session.user.role === "ADMIN" ? (
                                <Link href="/moderacion" className="font-semibold text-zinc-900 underline">
                                    Moderacion
                                </Link>
                            ) : null}
                            {session.user.role === "ADMIN" ? (
                                <Link href="/admin" className="font-semibold text-zinc-900 underline">
                                    Admin
                                </Link>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => signOut({ callbackUrl })}
                                className="rounded-md border border-zinc-300 px-2 py-1 font-semibold text-zinc-700"
                            >
                                Salir
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/login?next=${encodeURIComponent(callbackUrl)}`)
                            }
                            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
                        >
                            Iniciar sesion
                        </button>
                    )}

                    {showVersionSelector && versionSelector && (
                        <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-sm">
                            <span className="text-sm font-medium text-zinc-600">Versión</span>
                            <select
                                data-testid="version-selector"
                                value={versionSelector.selectedVersionId}
                                onChange={(event) => updateVersion(event.target.value)}
                                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500"
                            >
                                {visibleVersionOptions.map((option) => {
                                    const isDisabled = option.disponible === false;

                                    return (
                                        <option
                                            key={option.versionId}
                                            value={option.versionId}
                                            disabled={isDisabled}
                                        >
                                            {isDisabled ? `${option.label} (próximamente)` : option.label}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    )}

                    <a
                        href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Abrir easter egg en YouTube"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                    >
                        😬
                    </a>

                    {onReset && (
                        <button
                            type="button"
                            data-testid="reset-btn"
                            onClick={onReset}
                            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
                        >
                            Reiniciar progreso
                        </button>
                    )}

                    <button
                        type="button"
                        data-testid="toggle-progreso-btn"
                        aria-expanded={mostrarProgreso}
                        onClick={() => setMostrarProgreso((prev) => !prev)}
                        className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50"
                    >
                        {mostrarProgreso ? "Ocultar progreso" : "Mostrar progreso"}
                    </button>
                </div>
            </div>

            {mostrarProgreso && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="mb-1.5 text-sm text-zinc-500">Progreso general</div>
                            <div className="text-xl font-extrabold text-zinc-900">{porcentaje}% aprobado</div>
                        </div>

                        <div className="text-sm text-zinc-600">
                            {aprobadas} de {total} materias aprobadas
                        </div>
                    </div>

                    <div
                        aria-hidden="true"
                        className="mb-5 h-3 w-full overflow-hidden rounded-full bg-slate-100"
                    >
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-green-300 to-green-500 transition-[width] duration-200"
                            style={{ width: `${porcentaje}%` }}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <StatCard label="Aprobadas" value={aprobadas} />
                        <StatCard label="Cursadas" value={cursadas} />
                        <StatCard label="Disponibles" value={disponibles} />
                    </div>
                </div>
            )}
        </header>
    );
}