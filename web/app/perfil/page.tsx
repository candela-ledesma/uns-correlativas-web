import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ProfileWorkspace from "@/components/profile/ProfileWorkspace";
import { getUserProductContext } from "@/lib/userProductContext";
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

  const context = await getUserProductContext(session.user.id);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/" className={styles.backLink}>
            <span aria-hidden="true">←</span>
            Volver al inicio
          </Link>
        </div>

        <ProfileWorkspace
          role={rol}
          roleLabel={rolLabel}
          email={email}
          nombreVisible={nombreVisible}
          iniciales={iniciales}
          initialContext={context}
        />
      </section>
    </main>
  );
}
