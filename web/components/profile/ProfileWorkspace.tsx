"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildPlanHref,
  type UserProductContextResponse,
} from "@/lib/db/userProductContextTypes";
import styles from "@/app/perfil/page.module.css";

type Props = {
  role: "USER" | "MODERATOR" | "ADMIN";
  roleLabel: string;
  email: string;
  nombreVisible: string;
  iniciales: string;
  initialContext: UserProductContextResponse;
};

export default function ProfileWorkspace({
  role,
  roleLabel,
  email,
  nombreVisible,
  iniciales,
  initialContext,
}: Props) {
  const [context] = useState<UserProductContextResponse>(initialContext);

  const activeCareerId = context.activeCareerId ?? context.enrolledCareerIds[0] ?? null;

  const activeLastPlan = activeCareerId
    ? context.lastPlanByCareer[activeCareerId]
    : undefined;

  const lastPlanHref = activeCareerId
    ? buildPlanHref(activeCareerId, activeLastPlan)
    : "/";

  const activeCareerName = useMemo(() => {
    if (!activeCareerId) return null;
    return context.careers.find((c) => c.id === activeCareerId)?.nombre ?? null;
  }, [activeCareerId, context.careers]);

  const onboardingHref = `${lastPlanHref}${lastPlanHref.includes("?") ? "&" : "?"}onboarding=1`;

  // Enrolled careers to show in grid
  const enrolledCareers = useMemo(
    () => context.careers.filter((c) => context.enrolledCareerIds.includes(c.id)),
    [context.careers, context.enrolledCareerIds]
  );

  return (
    <article className={styles.profileCard}>

      {/* ── SECCIÓN 1: HERO ─────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.avatar} aria-hidden="true">{iniciales}</div>

        <div className={styles.identity}>
          <p className={styles.name}>{nombreVisible}</p>
          <p className={styles.email}>{email}</p>
          <div className={styles.pillRow}>
            <span className={styles.pillGreen}>Cuenta activa</span>
            <span className={styles.pillViolet}>{roleLabel}</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/api/auth/signout" className={styles.ghostBtn}>
            Cerrar sesión
          </Link>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── SECCIÓN 2: MIS CARRERAS ─────────────────────────────────────── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>MIS CARRERAS</p>

        <div className={styles.careerGrid}>
          {enrolledCareers.map((career) => {
            const isActive = career.id === activeCareerId;
            const planHref = buildPlanHref(career.id, context.lastPlanByCareer[career.id]);

            return (
              <div
                key={career.id}
                className={styles.careerCard}
                data-active={isActive ? "true" : undefined}
              >
                <p className={styles.careerName}>{career.nombre}</p>
                <p className={styles.careerSub}>Sin materias registradas aún</p>
                <div className={styles.careerFooter}>
                  {isActive && <span className={styles.pillVioletSm}>activa</span>}
                  <Link href={planHref} className={styles.openPlanBtn}>
                    Abrir plan →
                  </Link>
                </div>
              </div>
            );
          })}

          {enrolledCareers.length === 0 && (
            <p className={styles.emptyState}>No estás inscripto en ninguna carrera.</p>
          )}
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── SECCIÓN 3: ACCESOS RÁPIDOS ──────────────────────────────────── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>ACCESOS RÁPIDOS</p>

        <div className={styles.quickGrid}>
          <Link href="/" className={styles.quickCard}>
            <div className={styles.quickText}>
              <p className={styles.quickTitle}>Inicio</p>
              <p className={styles.quickSub}>Selector de carreras</p>
            </div>
            <span className={styles.quickArrow}>→</span>
          </Link>

          <Link href={lastPlanHref} className={styles.quickCard}>
            <div className={styles.quickText}>
              <p className={styles.quickTitle}>Último plan</p>
              <p className={styles.quickSub}>{activeCareerName ?? "Sin plan reciente"}</p>
            </div>
            <span className={styles.quickArrow}>→</span>
          </Link>

          <Link href={onboardingHref} className={styles.quickCard}>
            <div className={styles.quickText}>
              <p className={styles.quickTitle}>Ver tutorial</p>
              <p className={styles.quickSub}>Guía de uso</p>
            </div>
            <span className={styles.quickArrow}>→</span>
          </Link>

          {(role === "MODERATOR" || role === "ADMIN") && (
            <Link href="/admin" className={styles.quickCard}>
              <div className={styles.quickText}>
                <p className={styles.quickTitle}>Crear plan</p>
                <p className={styles.quickSub}>Subir y procesar un PDF</p>
              </div>
              <span className={styles.quickArrow}>→</span>
            </Link>
          )}

{role === "ADMIN" && (
            <Link href="/admin" className={styles.quickCard}>
              <div className={styles.quickText}>
                <p className={styles.quickTitle}>Administración</p>
                <p className={styles.quickSub}>Gestionar permisos y auditoría</p>
              </div>
              <span className={styles.quickArrow}>→</span>
            </Link>
          )}
        </div>
      </section>
    </article>
  );
}
