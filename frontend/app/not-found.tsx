import Link from "next/link";

export default function NotFound() {
    return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center">
        <h1 className="text-3xl font-bold">Carrera no encontrada</h1>
        <p className="mt-3 text-zinc-600">
        La carrera que intentaste abrir no existe o todavía no fue cargada.
        </p>
        <Link
        href="/"
        className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-white hover:bg-blue-700"
        >
        Volver al inicio
        </Link>
    </main>
    );
}