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

function tiempoRelativo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export default function HistorialTab() {
  const [items, setItems] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

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

  useEffect(() => { cargarHistorial(); }, []);

  return (
    <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12 }}>
        Planes guardados
      </div>

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

            const badgeColor = isPending ? "#f59e0b" : resolucion === "reemplazar" ? STATUS_COLORS.danger.accent : resolucion === "nueva_version" ? STATUS_COLORS.disponible.accent : STATUS_COLORS.aprobada.accent;
            const badgeBg    = isPending ? "rgba(245,158,11,0.12)" : resolucion === "reemplazar" ? STATUS_COLORS.danger.badgeBg : resolucion === "nueva_version" ? STATUS_COLORS.disponible.badgeBg : STATUS_COLORS.aprobada.badgeBg;
            const badgeBorder= isPending ? "rgba(245,158,11,0.35)" : resolucion === "reemplazar" ? STATUS_COLORS.danger.badgeBorder : resolucion === "nueva_version" ? STATUS_COLORS.disponible.badgeBorder : STATUS_COLORS.aprobada.badgeBorder;
            const badgeLabel = isPending ? "Pendiente" : resolucion === "reemplazar" ? "Reemplazado" : resolucion === "nueva_version" ? "v2" : "Nuevo";

            async function publicar() {
              setPublishing(item.id);
              try {
                await fetch("/api/admin/planes/guardar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    plan: after,
                    fuente: after?.fuente ?? "gemini",
                    publicar: true,
                    resolucion: null,
                  }),
                });
                cargarHistorial();
              } finally {
                setPublishing(null);
              }
            }

            return (
              <div
                key={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 6px",
                  borderBottom: i < items.length - 1 ? `1px solid ${GLASS.border}` : "none",
                  background: isPending ? "rgba(245,158,11,0.04)" : undefined,
                  borderRadius: isPending ? 8 : undefined,
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {isPending && (
                    <button
                      onClick={publicar}
                      disabled={publishing === item.id}
                      style={{
                        ...BTN_VIOLET, borderRadius: 6, padding: "4px 12px",
                        fontSize: 11, fontWeight: 600,
                        opacity: publishing === item.id ? 0.6 : 1,
                        cursor: publishing === item.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {publishing === item.id ? "Publicando…" : "Publicar"}
                    </button>
                  )}
                  <span style={{
                    background: badgeBg, border: `1px solid ${badgeBorder}`,
                    color: badgeColor, borderRadius: 5, padding: "2px 9px",
                    fontSize: 10, fontWeight: 600,
                  }}>
                    {badgeLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
