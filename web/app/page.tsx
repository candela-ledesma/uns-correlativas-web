import Link from "next/link";
import { CARRERAS } from "@/lib/carreras";
import HomeSessionPanel from "@/components/HomeSessionPanel";
import styles from "./page.module.css";

export default function HomePage() {
  const totalCarreras = CARRERAS.length;
  const carrerasDisponibles = CARRERAS.filter(
    (carrera) => carrera.disponible !== false,
  ).length;

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.topBar}>
          <div className={styles.brandPill}>
            <span className={styles.brandDot} aria-hidden="true" />
            UNS Correlativas
          </div>
          <div className={styles.topActions}>
            <HomeSessionPanel />
          </div>
        </div>

        <div className={styles.hero}>
          <a
            href="https://www.uns.edu.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.unsLink}
          >
            Universidad Nacional del Sur
          </a>

          <h1 className={styles.title}>Planes de estudio y correlativas</h1>

          <p className={styles.subtitle}>
            Elegí una carrera para ver su plan, marcar materias cursadas o
            aprobadas y descubrir cuáles tenés habilitadas.
          </p>

          <div className={styles.quickMeta}>
            <p>
              {carrerasDisponibles} de {totalCarreras} carreras disponibles
            </p>
            <span aria-hidden="true">•</span>
            <p>Progreso sincronizado por cuenta</p>
          </div>
        </div>

        <div className={styles.grid}>
          {CARRERAS.map((carrera, index) => {
            const disponible = carrera.disponible !== false;

            return (
              <Link
                key={carrera.id}
                href={`/planes/${carrera.id}`}
                className={styles.card}
                style={{
                  animationDelay: `${index * 70}ms`,
                }}
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