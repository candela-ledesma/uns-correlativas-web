import Link from "next/link";
import { CARRERAS } from "@/lib/carreras";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Planes de estudio UNS
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Seleccioná una carrera para ver su plan.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARRERAS.map((carrera) => (
            <Link
              key={carrera.id}
              href={`/planes/${carrera.id}`}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold">{carrera.nombre}</h2>
              <p className="mt-2 text-zinc-600">{carrera.descripcion}</p>
              <div className="mt-4 text-sm font-medium text-blue-600">
                Ver plan →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}