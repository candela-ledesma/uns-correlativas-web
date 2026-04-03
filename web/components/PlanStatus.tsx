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
    const borderClass =
    variant === "error" ? "border-red-200" : "border-zinc-200";

    return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className={`mx-auto max-w-3xl rounded-2xl border ${borderClass} bg-white p-8 shadow-sm`}>
        <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:underline"
        >
            ← Volver al inicio
        </Link>

        <h1 className="mt-4 text-3xl font-bold">{titulo}</h1>
        <p className="mt-3 text-zinc-600">{mensaje}</p>
        </div>
    </main>
    );
}