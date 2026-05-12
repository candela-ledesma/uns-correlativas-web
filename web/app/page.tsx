"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CARRERAS } from "@/lib/data/carreras";
import styles from "./page.module.css";

const HomeSessionPanel = dynamic(() => import("@/components/auth/HomeSessionPanel"), {
  ssr: false,
  loading: () => <div className={styles.sessionSkeleton} aria-hidden="true" />, 
});

function normalizarTexto(valor: string) {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export default function HomePage() {
  const [busqueda, setBusqueda] = useState("");
  const [deptoFiltro, setDeptoFiltro] = useState("");
  const totalCarreras = CARRERAS.length;
  const carrerasDisponibles = CARRERAS.filter(
    (carrera) => carrera.disponible !== false,
  ).length;

  const departamentos = useMemo(() => {
    const set = new Set(CARRERAS.map((c) => c.departamento).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, []);

  const carrerasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    return CARRERAS.filter((carrera) => {
      const matchNombre = !termino || normalizarTexto(carrera.nombre).includes(termino);
      const matchDepto = !deptoFiltro || carrera.departamento === deptoFiltro;
      return matchNombre && matchDepto;
    });
  }, [busqueda, deptoFiltro]);

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

        <div className={styles.searchWrap}>
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar carrera por nombre"
            aria-label="Buscar carrera por nombre"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterWrap}>
          {departamentos.map((dep) => (
            <button
              key={dep}
              onClick={() => setDeptoFiltro(deptoFiltro === dep ? "" : dep)}
              className={`${styles.filterChip} ${deptoFiltro === dep ? styles.filterChipActive : ""}`}
            >
              {dep}
            </button>
          ))}
        </div>

        {carrerasFiltradas.length === 0 && (
          <p className={styles.noResults}>
            No se encontraron carreras con ese nombre.
          </p>
        )}

        <div className={styles.grid}>
          {carrerasFiltradas.map((carrera, index) => {
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