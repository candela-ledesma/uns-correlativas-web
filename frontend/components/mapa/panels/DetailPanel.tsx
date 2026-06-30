"use client";

import { useMemo } from "react";
import type { Materia } from "@/app/types/plan";
import { GLASS, TEXT, TEXT_SEC, TEXT_DET } from "@/lib/ui/tokens";
import { STATE_STYLE, AMBER, getStateLabel, tieneAviso, type VisualEstado } from "@/lib/mapa/graphUtils";

type Props = {
  nodeId: string;
  materias: Materia[];
  idsAgrupadores: Set<string>;
  vmById: Map<string, VisualEstado>;
  reglamentoUrl?: string | null;
  onClose: () => void;
  onVerEnPlan?: (materiaId: string) => void;
  /** Omitted in contexts without a chain-highlight concept (e.g. EditorPanel) — hides the button. */
  caminoVisible?: boolean;
  onToggleCamino?: () => void;
};

export function DetailPanel({
  nodeId, materias, idsAgrupadores, vmById, reglamentoUrl, onClose, onVerEnPlan,
  caminoVisible, onToggleCamino,
}: Props) {
  const materiaById = useMemo(
    () => new Map(materias.map((m) => [String(m.id), m])),
    [materias],
  );
  const materia = materiaById.get(nodeId);
  if (!materia) return null;

  const ve = vmById.get(nodeId) ?? "bloqueada";
  const s = STATE_STYLE[ve];

  const requiere = Object.keys(materia.correlativas ?? {}).map((id) => ({
    id,
    nombre: materiaById.get(id)?.nombre ?? id,
    ve: vmById.get(id) ?? ("bloqueada" as VisualEstado),
  }));

  const habilita = materias
    .filter((m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion)
    .filter((m) => Object.keys(m.correlativas ?? {}).includes(nodeId))
    .map((m) => ({
      id: String(m.id),
      nombre: m.nombre,
      ve: vmById.get(String(m.id)) ?? ("bloqueada" as VisualEstado),
    }));

  const hasAviso = tieneAviso(materia);

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, color: TEXT_SEC, marginBottom: 4,
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const emptyText: React.CSSProperties = { fontSize: 11, color: TEXT_SEC, fontStyle: "italic" };
  const divider: React.CSSProperties = { borderTop: `1px solid ${GLASS.border}`, margin: "2px 0" };

  const renderList = (items: { id: string; nombre: string; ve: VisualEstado }[]) =>
    items.map((item) => (
      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATE_STYLE[item.ve].text, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: TEXT_DET, lineHeight: 1.3 }}>{item.nombre}</span>
      </div>
    ));

  return (
    <div style={{
      background: "rgba(15,20,50,0.95)", border: `1px solid ${GLASS.raised}`,
      borderRadius: 12, padding: "14px 16px", width: 260,
      maxHeight: "70vh", overflowY: "auto", backdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, flex: 1 }}>{materia.nombre}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <span style={{
        alignSelf: "flex-start", fontSize: 10, fontWeight: 600,
        color: s.text, background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 5, padding: "2px 8px",
      }}>{getStateLabel(ve)}</span>

      <div style={divider} />
      <div>
        <div style={sectionTitle}>Requiere</div>
        {requiere.length > 0 ? renderList(requiere) : <span style={emptyText}>Sin requisitos previos</span>}
      </div>
      <div style={divider} />
      <div>
        <div style={sectionTitle}>Habilita</div>
        {habilita.length > 0 ? renderList(habilita) : <span style={emptyText}>No habilita materias directas</span>}
      </div>
      <div style={divider} />

      {hasAviso && (
        <div style={{
          background: "rgba(239,159,39,0.08)", border: `1px solid ${AMBER.border}44`,
          borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: AMBER.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ⚠ Requisitos adicionales
          </div>
          <p style={{ fontSize: 11, color: TEXT_DET, lineHeight: 1.5, margin: 0 }}>
            Esta materia puede tener requisitos de porcentaje de carrera aprobada que no figuran en el plan. Verificá las condiciones actuales en la página del departamento antes de inscribirte.
          </p>
          {reglamentoUrl && (
            <a href={reglamentoUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: AMBER.text, textDecoration: "underline", alignSelf: "flex-start" }}>
              Ver reglamento →
            </a>
          )}
        </div>
      )}

      {onToggleCamino && (
        <button
          onClick={onToggleCamino}
          style={{
            background: caminoVisible ? AMBER.bg : "rgba(157,78,221,0.15)",
            border: caminoVisible ? `1px solid ${AMBER.border}` : "1px solid rgba(157,78,221,0.4)",
            borderRadius: 7, color: caminoVisible ? AMBER.text : "#c4a0f0",
            fontSize: 11, fontWeight: 600, padding: "6px 10px", cursor: "pointer", textAlign: "center",
          }}>
          {caminoVisible ? "Ocultar camino" : "Ver camino →"}
        </button>
      )}

      {onVerEnPlan && (
        <button
          onClick={() => onVerEnPlan(nodeId)}
          style={{
            background: "rgba(157,78,221,0.15)", border: "1px solid rgba(157,78,221,0.4)",
            borderRadius: 7, color: "#c4a0f0", fontSize: 11, fontWeight: 600,
            padding: "6px 10px", cursor: "pointer", textAlign: "center",
          }}>
          Ver en Plan
        </button>
      )}
    </div>
  );
}
