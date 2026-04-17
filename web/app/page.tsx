import Link from "next/link";
import { CARRERAS } from "@/lib/carreras";
import HomeSessionPanel from "@/components/HomeSessionPanel";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.hero}>
          <a
          href="https://www.uns.edu.ar/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          Universidad Nacional del Sur
        </a>

          <h1 className={styles.title}>Planes de estudio y correlativas</h1>

          <p className={styles.subtitle}>
            Elegí una carrera para ver su plan, marcar materias cursadas o
            aprobadas y descubrir cuáles tenés habilitadas.
          </p>

          <HomeSessionPanel />
        </div>

        <div className={styles.grid}>
          {CARRERAS.map((carrera) => {
            const disponible = carrera.disponible !== false;

            return (
              <Link
                key={carrera.id}
                href={`/planes/${carrera.id}`}
                className={styles.card}
              >
                <div className={styles.cardTopBar} />

                <div className={styles.cardHeader}>
                  <div className={styles.iconBox}>🎓</div>

                  <span
                    className={`${styles.status} ${
                      disponible ? styles.statusAvailable : styles.statusSoon
                    }`}
                  >
                    {disponible ? "Disponible" : "Próximamente"}
                  </span>
                </div>

                <h2 className={styles.cardTitle}>{carrera.nombre}</h2>

                <p className={styles.cardDescription}>{carrera.descripcion}</p>

                <div className={styles.cardFooter}>
                  <span className={styles.cardFooterText}>
                    {disponible ? "Ver plan" : "Más adelante"}
                  </span>

                  <span className={styles.arrow}>→</span>
                </div>
              </Link>
            );
          })}
        </div>

      </section>
    </main>
  );
}