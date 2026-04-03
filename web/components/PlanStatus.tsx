import Link from "next/link";

type Props = {
    titulo: string;
    mensaje: string;
    variant?: "info" | "error";
};

export default function PlanStatus({
    titulo,
    mensaje,
    variant = "info",
}: Props) {
    const isError = variant === "error";

    return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
        <div className="mb-6">
            <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
            <span aria-hidden="true">←</span>
            <span>Volver al inicio</span>
            </Link>
        </div>

        <section
            className={`rounded-3xl border bg-white p-8 shadow-sm ${
            isError ? "border-red-200" : "border-zinc-200"
            }`}
        >
            <div
            className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl ${
                isError
                ? "bg-red-100 text-red-700"
                : "bg-zinc-100 text-zinc-700"
            }`}
            >
            {isError ? "!" : "i"}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            {titulo}
            </h1>

            <p className="mt-3 text-base leading-7 text-zinc-600">{mensaje}</p>
        </section>
        </div>
    </main>
    );
}