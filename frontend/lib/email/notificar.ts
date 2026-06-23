import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type NotificarRevisionParams = {
  carrera: string;
  universidad: string;
  materias: number;
  fuente: string;
  enviadoPor: string;
  nota?: string;
  slug: string;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function notificarRevisionPendiente(params: NotificarRevisionParams): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  if (!adminEmail || !apiKey) return;

  const { carrera, universidad, materias, fuente, enviadoPor, nota } = params;

  const adminUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";

  const safeCarrera = escapeHtml(carrera);
  const safeUniversidad = escapeHtml(universidad);
  const safeMaterias = escapeHtml(String(materias));
  const safeFuente = escapeHtml(fuente);
  const safeEnviadoPor = escapeHtml(enviadoPor);
  const safeNota = nota ? escapeHtml(nota) : null;

  await resend.emails.send({
    from: "UNS Correlativas <noreply@resend.dev>",
    to: adminEmail,
    subject: `Plan pendiente de revisión: ${safeCarrera}`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
        <h2 style="color: #9d4edd;">Plan enviado a revisión</h2>
        <p>Un moderador envió un plan para tu revisión.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #666;">Carrera</td><td style="padding: 6px 0; font-weight: 600;">${safeCarrera}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Universidad</td><td style="padding: 6px 0;">${safeUniversidad}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Materias</td><td style="padding: 6px 0;">${safeMaterias}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Fuente</td><td style="padding: 6px 0;">${safeFuente}</td></tr>
          <tr><td style="padding: 6px 0; color: #666;">Enviado por</td><td style="padding: 6px 0;">${safeEnviadoPor}</td></tr>
          ${safeNota ? `<tr><td style="padding: 6px 0; color: #666;">Nota</td><td style="padding: 6px 0; font-style: italic;">${safeNota}</td></tr>` : ""}
        </table>
        <a href="${adminUrl}/admin?tab=historial" style="display: inline-block; background: #9d4edd; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ver en el panel admin
        </a>
      </div>
    `,
  });
}
