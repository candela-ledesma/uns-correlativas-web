import Link from "next/link";
import { CARRERAS } from "@/lib/carreras";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.hero}>
          <span className={styles.badge}>Universidad Nacional del Sur</span>

          <h1 className={styles.title}>Planes de estudio y correlativas</h1>

          <p className={styles.subtitle}>
            Elegí una carrera para ver su plan, marcar materias cursadas o
            aprobadas y descubrir cuáles tenés habilitadas.
          </p>
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