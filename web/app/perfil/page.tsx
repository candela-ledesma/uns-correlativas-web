import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import styles from "./page.module.css";

export default async function PerfilPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?next=/perfil");
  }

  const email = session.user.email ?? "sin-email@uns.local";
  const nombreVisible = session.user.name ?? email.split("@")[0];
  const rol = session.user.role ?? "USER";
  const iniciales = nombreVisible.slice(0, 2).toUpperCase();
  const rolLabel =
    rol === "ADMIN"
      ? "Administrador"
      : rol === "MODERATOR"
        ? "Moderador"
        : "Usuario";

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/" className={styles.backLink}>
            <span aria-hidden="true">←</span>
            Volver al inicio
          </Link>
        </div>

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
              <span className={`${styles.chip} ${styles.roleChip}`}>{rolLabel}</span>
            </div>
          </div>

          <div className={styles.divider} />

          <section className={styles.actions}>
            <h2 className={styles.sectionTitle}>Accesos rápidos</h2>

            <div className={styles.actionGrid}>
              <Link href="/" className={styles.actionCard}>
                <p className={styles.actionTitle}>Inicio</p>
                <p className={styles.actionText}>Volver al selector de carreras</p>
                <span className={styles.actionArrow} aria-hidden="true">
                  →
                </span>
              </Link>

              <Link href="/planes/arquitectura" className={styles.actionCard}>
                <p className={styles.actionTitle}>Plan</p>
                <p className={styles.actionText}>Abrir plan de Arquitectura</p>
                <span className={styles.actionArrow} aria-hidden="true">
                  →
                </span>
              </Link>

              {(rol === "MODERATOR" || rol === "ADMIN") && (
                <Link href="/moderacion" className={styles.actionCard}>
                  <p className={styles.actionTitle}>Moderación</p>
                  <p className={styles.actionText}>Revisar cambios pendientes</p>
                  <span className={styles.actionArrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              )}

              {rol === "ADMIN" && (
                <Link href="/admin" className={styles.actionCard}>
                  <p className={styles.actionTitle}>Administración</p>
                  <p className={styles.actionText}>Gestionar permisos y auditoría</p>
                  <span className={styles.actionArrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              )}
            </div>
          </section>
        </article>
      </section>
    </main>
  );
}
