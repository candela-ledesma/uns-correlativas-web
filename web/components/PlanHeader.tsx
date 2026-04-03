"use client";

type Props = {
    titulo: string;
    subtitulo?: string;
    aprobadas: number;
    cursadas: number;
    disponibles: number;
    total: number;
    onReset?: () => void;
};

function StatCard({
    label,
    value,
}: {
    label: string;
    value: number;
}) {
    return (
    <div className="min-w-[120px] rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-1.5 text-sm text-zinc-500">{label}</div>
        <div className="text-2xl font-extrabold leading-none text-zinc-900">
        {value}
        </div>
    </div>
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
}: Props) {
  const porcentaje = total > 0 ? Math.round((aprobadas / total) * 100) : 0;

    return (
    <header className="mb-9 grid gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
            <h1 className="mb-2 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-tight tracking-tight text-zinc-900">
            {titulo}
            </h1>

            {subtitulo && (
            <p className="m-0 text-base text-zinc-600">{subtitulo}</p>
            )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
        </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
            <div className="mb-1.5 text-sm text-zinc-500">Progreso general</div>
            <div className="text-xl font-extrabold text-zinc-900">
                {porcentaje}% aprobado
            </div>
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
    </header>
    );
}