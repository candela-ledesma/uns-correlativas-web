"use client";

import { useEffect, useState } from "react";
import { GLASS, TEXT, TEXT_SEC, SURFACE, STATUS_COLORS, BTN_VIOLET, BTN } from "@/lib/ui/tokens";

type HistorialItem = {
  id: string;
  action: string;
  createdAt: string;
  actorEmail: string | null;
  entityId: string;
  reason: string | null;
  after: {
    carrera?: string;
    universidad?: string;
    materias?: number;
    fuente?: string;
    resolucion?: string;
    codigo_plan?: string;
  } | null;
};

type PlanPendiente = {
  slug: string;
  file: string;
  mtime: string;
  plan: {
    plan: { carrera: string; universidad: string; codigo_plan: string };
    materias: Array<{ id: string }>;
    agrupadores: unknown[];
    _fuente?: string;
    _enviado_by_email?: string;
    _nota_revision?: string;
    [key: string]: unknown;
  };
};

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

function SeccionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

export default function HistorialTab() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [pendientes, setPendientes] = useState<PlanPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPendientes, setLoadingPendientes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ slug: string; ok: boolean; msg: string } | null>(null);

  function cargarHistorial() {
    setLoading(true);
    setError(null);
    fetch("/api/admin/auditoria?limit=50")
      .then(r => r.json())
      .then(data => {
        const planes = (data.items ?? []).filter(
          (i: { action: string }) => i.action === "PLAN_SAVED" || i.action === "PLAN_PENDING_REVIEW"
        );
        setItems(planes);
      })
      .catch(() => setError("No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  }

  function cargarPendientes() {
    setLoadingPendientes(true);
    fetch("/api/admin/planes/pendientes")
      .then(r => r.json())
      .then(data => setPendientes(data.planes ?? []))
      .catch(() => setPendientes([]))
      .finally(() => setLoadingPendientes(false));
  }

  useEffect(() => {
    cargarHistorial();
    cargarPendientes();
  }, []);

  async function publicarPendiente(p: PlanPendiente) {
    setPublishing(p.slug);
    setPublishMsg(null);
    try {
      const res = await fetch("/api/admin/planes/guardar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: p.plan,
          fuente: p.plan._fuente ?? "gemini",
          publicar: true,
          resolucion: null,
        }),
      });
      const data = await res.json();
      if (data.conflict) {
        setPublishMsg({ slug: p.slug, ok: false, msg: `Ya existe un JSON para esta carrera (${data.existing?.materias} materias, cargado ${data.existing?.fechaCarga}). Publicá desde el panel de carga para resolver el conflicto.` });
      } else if (data.ok) {
        setPublishMsg({ slug: p.slug, ok: true, msg: "Plan publicado correctamente." });
        cargarPendientes();
        cargarHistorial();
      } else {
        setPublishMsg({ slug: p.slug, ok: false, msg: data.error ?? "Error al publicar." });
      }
    } finally {
      setPublishing(null);
    }
  }

  async function descartarPendiente(p: PlanPendiente) {
    setDiscarding(p.slug);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/admin/planes/pendientes/${p.slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        cargarPendientes();
        cargarHistorial();
      } else {
        setPublishMsg({ slug: p.slug, ok: false, msg: data.error ?? "Error al descartar." });
      }
    } finally {
      setDiscarding(null);
      setConfirmDiscard(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Revisiones pendientes ── */}
      <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
        <SeccionLabel>Revisiones pendientes</SeccionLabel>

        {loadingPendientes && (
          <div style={{ textAlign: "center", padding: "24px 0", color: TEXT_SEC, fontSize: 13 }}>Cargando…</div>
        )}

        {!loadingPendientes && pendientes.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: TEXT_SEC, fontSize: 13 }}>
            No hay planes en revisión.
          </div>
        )}

        {!loadingPendientes && pendientes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {pendientes.map((p, i) => (
              <div key={p.slug}>
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "14px 10px",
                  background: "rgba(245,158,11,0.05)",
                  borderRadius: 8,
                  border: `1px solid rgba(245,158,11,0.25)`,
                  marginBottom: i < pendientes.length - 1 ? 10 : 0,
                }}>
                  <span style={{ fontSize: 22, opacity: 0.7, marginTop: 1 }}>⏳</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>
                      {p.plan.plan.carrera}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 3 }}>
                      {p.plan.plan.universidad}
                      {" · "}{p.plan.materias.length} materias
                      {" · "}{p.plan._fuente ?? "gemini"}
                      {" · "}{tiempoRelativo(p.mtime)}
                      {p.plan._enviado_by_email ? ` · ${p.plan._enviado_by_email}` : ""}
                    </div>
                    {p.plan._nota_revision && (
                      <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 4, fontStyle: "italic" }}>
                        &quot;{p.plan._nota_revision}&quot;
                      </div>
                    )}
                    {publishMsg?.slug === p.slug && (
                      <div style={{
                        fontSize: 11, marginTop: 6, fontWeight: 500,
                        color: publishMsg.ok ? "#90be6d" : "#f87171",
                      }}>
                        {publishMsg.msg}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{
                      background: "rgba(245,158,11,0.12)",
                      border: "1px solid rgba(245,158,11,0.35)",
                      color: "#f59e0b",
                      borderRadius: 5, padding: "2px 9px",
                      fontSize: 10, fontWeight: 600,
                    }}>
                      Pendiente
                    </span>
                    {confirmDiscard === p.slug ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span style={{ fontSize: 11, color: "#f87171", fontWeight: 500 }}>
                          ¿Seguro que querés descartar?
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => setConfirmDiscard(null)}
                            style={{ ...BTN, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => descartarPendiente(p)}
                            disabled={discarding === p.slug}
                            style={{
                              background: "rgba(248,113,113,0.15)",
                              border: "1px solid rgba(248,113,113,0.4)",
                              color: "#f87171",
                              borderRadius: 6, padding: "4px 10px",
                              fontSize: 11, fontWeight: 600,
                              opacity: discarding === p.slug ? 0.6 : 1,
                              cursor: discarding === p.slug ? "not-allowed" : "pointer",
                            }}
                          >
                            {discarding === p.slug ? "Descartando…" : "Confirmar"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setConfirmDiscard(p.slug)}
                          style={{ ...BTN, borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Descartar
                        </button>
                        <button
                          onClick={() => window.open(`/admin/revisiones/${p.slug}`, "_blank")}
                          style={{ ...BTN, borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                        >
                          Revisar
                        </button>
                        <button
                          onClick={() => publicarPendiente(p)}
                          disabled={publishing === p.slug}
                          style={{
                            ...BTN_VIOLET, borderRadius: 6, padding: "5px 14px",
                            fontSize: 12, fontWeight: 600,
                            opacity: publishing === p.slug ? 0.6 : 1,
                            cursor: publishing === p.slug ? "not-allowed" : "pointer",
                          }}
                        >
                          {publishing === p.slug ? "Publicando…" : "Publicar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Historial ── */}
      <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
        <SeccionLabel>Planes guardados</SeccionLabel>

        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_SEC, fontSize: 13 }}>Cargando…</div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "32px 0", color: STATUS_COLORS.danger.accent, fontSize: 13 }}>{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: TEXT_SEC, fontSize: 13 }}>
            Todavía no se guardó ningún plan.
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item, i) => {
              const after = item.after;
              const carrera = after?.carrera ?? item.entityId;
              const universidad = after?.universidad ?? "—";
              const materias = after?.materias;
              const fuente = after?.fuente ?? "—";
              const isPending = item.action === "PLAN_PENDING_REVIEW";
              const resolucion = after?.resolucion ?? "nuevo";

              const badgeColor  = isPending ? "#f59e0b" : resolucion === "reemplazar" ? STATUS_COLORS.danger.accent : resolucion === "nueva_version" ? STATUS_COLORS.disponible.accent : STATUS_COLORS.aprobada.accent;
              const badgeBg     = isPending ? "rgba(245,158,11,0.12)" : resolucion === "reemplazar" ? STATUS_COLORS.danger.badgeBg : resolucion === "nueva_version" ? STATUS_COLORS.disponible.badgeBg : STATUS_COLORS.aprobada.badgeBg;
              const badgeBorder = isPending ? "rgba(245,158,11,0.35)" : resolucion === "reemplazar" ? STATUS_COLORS.danger.badgeBorder : resolucion === "nueva_version" ? STATUS_COLORS.disponible.badgeBorder : STATUS_COLORS.aprobada.badgeBorder;
              const badgeLabel  = isPending ? "Pendiente" : resolucion === "reemplazar" ? "Reemplazado" : resolucion === "nueva_version" ? "v2" : "Nuevo";

              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 6px",
                    borderBottom: i < items.length - 1 ? `1px solid ${GLASS.border}` : "none",
                  }}
                >
                  <span style={{ fontSize: 20, opacity: 0.6 }}>{isPending ? "⏳" : "📄"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {carrera}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>
                      {universidad}
                      {materias != null ? ` · ${materias} materias` : ""}
                      {" · "}{fuente}
                      {" · "}{tiempoRelativo(item.createdAt)}
                      {item.actorEmail ? ` · ${item.actorEmail}` : ""}
                    </div>
                    {item.reason && (
                      <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2, fontStyle: "italic" }}>
                        &quot;{item.reason}&quot;
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: badgeBg, border: `1px solid ${badgeBorder}`,
                    color: badgeColor, borderRadius: 5, padding: "2px 9px",
                    fontSize: 10, fontWeight: 600, flexShrink: 0,
                  }}>
                    {badgeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
