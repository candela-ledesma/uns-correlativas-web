import { BG_GRADIENT, TEXT, TEXT_SEC, TEXT_DET, SURFACE } from "@/lib/ui/tokens";

export const metadata = {
  title: "Política de Privacidad — UNS Correlativas",
  description: "Política de privacidad de la aplicación UNS Correlativas.",
};

export default function PrivacidadPage() {
  return (
    <main
      style={{
        minHeight: "100svh",
        background: BG_GRADIENT,
        padding: "48px 16px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <article
        style={{
          ...SURFACE,
          borderRadius: 20,
          padding: "40px 36px",
          maxWidth: 720,
          width: "100%",
          lineHeight: 1.7,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ margin: 0, color: TEXT, fontSize: 26, fontWeight: 700 }}>
            Política de Privacidad
          </h1>
          <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13 }}>
            Última actualización: junio 2025
          </p>
        </header>

        <Section title="¿Qué es UNS Correlativas?">
          UNS Correlativas es una aplicación web sin fines de lucro para estudiantes de la
          Universidad Nacional del Sur (UNS). Permite visualizar planes de estudio,
          registrar el progreso académico y organizar horarios de cursada.
        </Section>

        <Section title="Información que recopilamos">
          <p style={{ margin: 0 }}>Al iniciar sesión con Google, accedemos a:</p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li><strong style={{ color: TEXT }}>Nombre y foto de perfil</strong> — para mostrarte en la app.</li>
            <li><strong style={{ color: TEXT }}>Dirección de email</strong> — como identificador único de tu cuenta.</li>
          </ul>
          <p style={{ margin: "12px 0 0" }}>
            Además, guardamos la información que vos cargás en la app:
          </p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Materias aprobadas, en curso o pendientes.</li>
            <li>Bloques de horario del planificador semanal.</li>
            <li>Preferencias de visualización.</li>
          </ul>
        </Section>

        <Section title="Google Calendar (opcional)">
          Si elegís conectar tu Google Calendar desde el planificador, solicitamos permiso
          para <strong style={{ color: TEXT }}>crear y eliminar eventos en tu calendario</strong>.
          Este permiso se usa exclusivamente para exportar tu horario de cursada como eventos
          recurrentes semanales. No leemos ni modificamos ningún otro evento de tu calendario.
          Podés revocar este acceso en cualquier momento desde{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#a78bfa", textDecoration: "underline" }}
          >
            myaccount.google.com/permissions
          </a>.
        </Section>

        <Section title="Cómo usamos tu información">
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Identificar tu cuenta y mostrarte tu progreso académico.</li>
            <li>Exportar tu horario a Google Calendar si lo solicitás.</li>
            <li>Mejorar la experiencia general de la aplicación.</li>
          </ul>
          <p style={{ margin: "12px 0 0" }}>
            No vendemos ni compartimos tu información con terceros. No usamos tus datos
            para publicidad.
          </p>
        </Section>

        <Section title="Almacenamiento y seguridad">
          Tus datos se almacenan en una base de datos segura (Neon/PostgreSQL). El acceso
          está protegido por autenticación y solo vos podés ver tu propio progreso, salvo
          que uses la función de compartir explícitamente.
        </Section>

        <Section title="Eliminación de datos">
          Podés solicitar la eliminación de tu cuenta y todos tus datos enviando un email a{" "}
          <a
            href="mailto:candelaledesmapm@gmail.com"
            style={{ color: "#a78bfa", textDecoration: "underline" }}
          >
            candelaledesmapm@gmail.com
          </a>
          . Procesamos las solicitudes dentro de los 30 días.
        </Section>

        <Section title="Contacto">
          Para cualquier consulta sobre privacidad, escribinos a{" "}
          <a
            href="mailto:candelaledesmapm@gmail.com"
            style={{ color: "#a78bfa", textDecoration: "underline" }}
          >
            candelaledesmapm@gmail.com
          </a>.
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h2 style={{ margin: 0, color: TEXT, fontSize: 16, fontWeight: 700 }}>{title}</h2>
      <div style={{ color: TEXT_DET, fontSize: 14 }}>{children}</div>
    </section>
  );
}
