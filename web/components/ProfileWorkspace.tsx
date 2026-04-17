"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildPlanHref,
  type UserActivityItem,
  type UserProductContextResponse,
} from "@/lib/userProductContextTypes";
import styles from "@/app/perfil/page.module.css";

type Props = {
  role: "USER" | "MODERATOR" | "ADMIN";
  roleLabel: string;
  email: string;
  nombreVisible: string;
  iniciales: string;
  initialContext: UserProductContextResponse;
};

const estadoLabelMap: Record<string, string> = {
  no_cursada: "No cursada",
  cursada: "Cursada",
  aprobada: "Aprobada",
};

function toLocalDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMateriaCode(materiaKey: string | null) {
  if (!materiaKey) return "desconocida";
  if (!materiaKey.includes("::")) return materiaKey;

  const [, materiaId] = materiaKey.split("::");
  return materiaId || materiaKey;
}

function getActivityText(
  activity: UserActivityItem,
  careerNameById: Map<string, string>
) {
  if (activity.type === "MATERIA_STATUS_CHANGED") {
    const materiaCode = getMateriaCode(activity.materiaKey);
    const fromLabel = estadoLabelMap[activity.fromState ?? ""] ?? "Sin estado";
    const toLabel = estadoLabelMap[activity.toState ?? ""] ?? "Sin estado";

    return `Materia ${materiaCode}: ${fromLabel} -> ${toLabel}`;
  }

  if (activity.type === "ACTIVE_CAREER_CHANGED") {
    const nextCareerName = activity.careerId
      ? careerNameById.get(activity.careerId) ?? activity.careerId
      : "sin carrera";

    return `Carrera activa actualizada a ${nextCareerName}`;
  }

  if (activity.type === "PLAN_OPENED") {
    const careerName = activity.careerId
      ? careerNameById.get(activity.careerId) ?? activity.careerId
      : activity.planId ?? "plan";

    return `Se abrió el plan de ${careerName}`;
  }

  if (activity.type === "ONBOARDING_COMPLETED") {
    return "Onboarding completado";
  }

  if (activity.type === "ONBOARDING_DISMISSED") {
    return "Onboarding omitido";
  }

  return "Onboarding reiniciado";
}

export default function ProfileWorkspace({
  role,
  roleLabel,
  email,
  nombreVisible,
  iniciales,
  initialContext,
}: Props) {
  const [context, setContext] = useState<UserProductContextResponse>(initialContext);
  const [isSavingCareerContext, setIsSavingCareerContext] = useState(false);
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCareerId = context.activeCareerId ?? context.enrolledCareerIds[0] ?? null;

  const careerNameById = useMemo(() => {
    return new Map(context.careers.map((career) => [career.id, career.nombre]));
  }, [context.careers]);

  const activeCareer = activeCareerId
    ? context.careers.find((career) => career.id === activeCareerId) ?? null
    : null;

  const activeLastPlan = activeCareerId
    ? context.lastPlanByCareer[activeCareerId]
    : undefined;

  const lastPlanHref = activeCareerId
    ? buildPlanHref(activeCareerId, activeLastPlan)
    : "/";

  const onboardingHref = `${lastPlanHref}${lastPlanHref.includes("?") ? "&" : "?"}onboarding=1`;

  async function saveCareerContext(nextEnrolledCareerIds: string[], nextActiveCareerId: string) {
    setIsSavingCareerContext(true);
    setError(null);

    const response = await fetch("/api/perfil/contexto", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enrolledCareerIds: nextEnrolledCareerIds,
        activeCareerId: nextActiveCareerId,
      }),
    }).catch(() => null);

    setIsSavingCareerContext(false);

    if (!response?.ok) {
      setError("No se pudo actualizar la carrera activa. Volvé a intentarlo.");
      return;
    }

    const updatedContext = (await response.json()) as UserProductContextResponse;
    setContext(updatedContext);
  }

  function handleEnrollmentToggle(careerId: string, checked: boolean) {
    const currentSet = new Set(context.enrolledCareerIds);

    if (checked) {
      currentSet.add(careerId);
    } else {
      currentSet.delete(careerId);
    }

    const nextEnrolledCareerIds = context.careers
      .map((career) => career.id)
      .filter((id) => currentSet.has(id));

    if (nextEnrolledCareerIds.length === 0) {
      setError("El usuario debe estar inscripto en al menos una carrera.");
      return;
    }

    const nextActiveCareerId =
      activeCareerId && nextEnrolledCareerIds.includes(activeCareerId)
        ? activeCareerId
        : nextEnrolledCareerIds[0];

    void saveCareerContext(nextEnrolledCareerIds, nextActiveCareerId);
  }

  function handleActiveCareerChange(nextActiveCareerId: string) {
    if (!context.enrolledCareerIds.includes(nextActiveCareerId)) {
      setError("La carrera activa debe estar en las carreras inscriptas.");
      return;
    }

    void saveCareerContext(context.enrolledCareerIds, nextActiveCareerId);
  }

  async function handleResetOnboarding() {
    setIsResettingOnboarding(true);
    setError(null);

    const response = await fetch("/api/perfil/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "reset",
      }),
    }).catch(() => null);

    if (!response?.ok) {
      setError("No se pudo reiniciar el onboarding.");
      setIsResettingOnboarding(false);
      return;
    }

    const onboardingData = (await response.json()) as {
      onboardingCompletedAt: string | null;
      onboardingDismissedAt: string | null;
      shouldAutoShowOnboarding: boolean;
    };

    setContext((prev) => ({
      ...prev,
      onboardingCompletedAt: onboardingData.onboardingCompletedAt,
      onboardingDismissedAt: onboardingData.onboardingDismissedAt,
      shouldAutoShowOnboarding: onboardingData.shouldAutoShowOnboarding,
    }));

    setIsResettingOnboarding(false);
  }

  return (
    <article className={styles.profileCard}>
      <div className={styles.header}>
        <div className={styles.avatar} aria-hidden="true">
          {iniciales}
        </div>

        <div className={styles.identity}>
          <h1 className={styles.title}>Perfil</h1>
          <p className={styles.name}>{nombreVisible}</p>
          <p className={styles.email}>{email}</p>
        </div>

        <div className={styles.chips}>
          <span className={styles.chip}>Cuenta activa</span>
          <span className={`${styles.chip} ${styles.roleChip}`}>{roleLabel}</span>
        </div>
      </div>

      <div className={styles.divider} />

      {error && <p className={styles.errorBanner}>{error}</p>}

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeadingRow}>
          <h2 className={styles.sectionTitle}>Carrera activa y contexto</h2>
          {isSavingCareerContext && <span className={styles.mutedTag}>Guardando...</span>}
        </div>

        <div className={styles.contextGrid}>
          <div className={styles.contextCard}>
            <p className={styles.contextLabel}>Carrera activa</p>
            <select
              className={styles.select}
              value={activeCareerId ?? ""}
              onChange={(event) => handleActiveCareerChange(event.target.value)}
              disabled={isSavingCareerContext}
            >
              {context.enrolledCareerIds.map((careerId) => {
                const careerName = careerNameById.get(careerId) ?? careerId;

                return (
                  <option key={careerId} value={careerId}>
                    {careerName}
                  </option>
                );
              })}
            </select>
            <p className={styles.contextDescription}>
              {activeCareer ? activeCareer.descripcion : "Sin carrera activa"}
            </p>
          </div>

          <div className={styles.contextCard}>
            <p className={styles.contextLabel}>Ultimo plan abierto</p>
            <p className={styles.contextDescription}>
              {activeCareer
                ? `${activeCareer.nombre} ${activeLastPlan ? `(${activeLastPlan.versionId})` : "(sin historial)"}`
                : "No hay carrera activa"}
            </p>
            <Link href={lastPlanHref} className={styles.contextAction}>
              Abrir ultimo plan
            </Link>
          </div>
        </div>

        <div className={styles.enrollmentList}>
          {context.careers.map((career) => {
            const checked = context.enrolledCareerIds.includes(career.id);

            return (
              <label key={career.id} className={styles.enrollmentItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isSavingCareerContext}
                  onChange={(event) => handleEnrollmentToggle(career.id, event.target.checked)}
                />
                <span>{career.nombre}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <h2 className={styles.sectionTitle}>Onboarding</h2>
        <p className={styles.contextDescription}>
          Guia corta para marcar materias y entender habilitacion de correlativas.
        </p>
        <div className={styles.inlineActions}>
          <Link href={onboardingHref} className={styles.actionButton}>
            Ver onboarding ahora
          </Link>
          <button
            type="button"
            className={styles.actionButtonSecondary}
            onClick={() => {
              void handleResetOnboarding();
            }}
            disabled={isResettingOnboarding}
          >
            {isResettingOnboarding ? "Reiniciando..." : "Reiniciar onboarding"}
          </button>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <h2 className={styles.sectionTitle}>Accesos rapidos</h2>

        <div className={styles.actionGrid}>
          <Link href="/" className={styles.actionCard}>
            <p className={styles.actionTitle}>Inicio</p>
            <p className={styles.actionText}>Volver al selector de carreras</p>
            <span className={styles.actionArrow} aria-hidden="true">
              -&gt;
            </span>
          </Link>

          <Link href={lastPlanHref} className={styles.actionCard}>
            <p className={styles.actionTitle}>Ultimo plan</p>
            <p className={styles.actionText}>Reanudar el plan de tu carrera activa</p>
            <span className={styles.actionArrow} aria-hidden="true">
              -&gt;
            </span>
          </Link>

          {(role === "MODERATOR" || role === "ADMIN") && (
            <Link href="/moderacion" className={styles.actionCard}>
              <p className={styles.actionTitle}>Moderacion</p>
              <p className={styles.actionText}>Revisar cambios pendientes</p>
              <span className={styles.actionArrow} aria-hidden="true">
                -&gt;
              </span>
            </Link>
          )}

          {role === "ADMIN" && (
            <Link href="/admin" className={styles.actionCard}>
              <p className={styles.actionTitle}>Administracion</p>
              <p className={styles.actionText}>Gestionar permisos y auditoria</p>
              <span className={styles.actionArrow} aria-hidden="true">
                -&gt;
              </span>
            </Link>
          )}
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <h2 className={styles.sectionTitle}>Historial de actividad</h2>

        {context.recentActivity.length === 0 && (
          <p className={styles.emptyState}>Todavia no hay actividad registrada.</p>
        )}

        {context.recentActivity.length > 0 && (
          <ul className={styles.activityList}>
            {context.recentActivity.map((activity) => (
              <li key={activity.id} className={styles.activityItem}>
                <p className={styles.activityText}>
                  {getActivityText(activity, careerNameById)}
                </p>
                <p className={styles.activityDate}>{toLocalDate(activity.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
