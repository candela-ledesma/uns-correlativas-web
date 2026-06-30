"use client";

import { useState } from "react";
import type { NodeProps, EdgeProps } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { BaseEdge, getBezierPath, Handle, Position } from "@xyflow/react";
import { TEXT, TEXT_DET, ACCENT } from "@/lib/ui/tokens";
import { STATE_STYLE, AMBER, getStateLabel, type NodeData, type AgrupadorNodeData } from "@/lib/mapa/graphUtils";

// ── MateriaNode ───────────────────────────────────────────────────────────────
export function MateriaNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { label, horas, visualEstado, highlighted, dimmed, hasAviso, pasoCamino } = data;
  const s = STATE_STYLE[visualEstado];
  const baseOpacity = dimmed ? 0.1 : visualEstado === "bloqueada" ? 0.85 : 1;
  const ringBorder = highlighted ? `2px solid ${s.text}` : `1px solid ${s.border}`;
  const shadow = highlighted ? `0 0 0 3px ${s.text}44` : "none";

  return (
    <div style={{
      width: 160, minHeight: 70, padding: "8px 10px",
      background: s.bg,
      border: selected ? `2px solid ${s.text}` : ringBorder,
      borderRadius: 10, display: "flex", flexDirection: "column", gap: 4,
      boxShadow: selected ? `0 0 0 3px ${s.text}66` : shadow,
      opacity: baseOpacity, transition: "opacity 0.12s",
      position: "relative",
    }}>
      <Handle type="target" position={Position.Left}  style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      {pasoCamino !== undefined && (
        <span style={{
          position: "absolute", top: -9, left: -9, width: 20, height: 20,
          borderRadius: "50%", background: AMBER.border, color: "#1a1a1a",
          fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          pointerEvents: "none", zIndex: 1,
        }}>
          {pasoCamino}
        </span>
      )}
      {hasAviso && (
        <span style={{ position: "absolute", top: 5, right: 6, fontSize: 9, color: AMBER.text }}>⚠</span>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word", pointerEvents: "none", paddingRight: hasAviso ? 14 : 0 }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", pointerEvents: "none" }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: s.text,
          background: visualEstado === "bloqueada" ? "#3a3a4a" : `${s.bg}99`,
          border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 5px",
        }}>
          {getStateLabel(visualEstado)}
        </span>
        <span style={{ fontSize: 9, color: TEXT_DET }}>{horas}h</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

// ── AgrupadorNode ─────────────────────────────────────────────────────────────
export function AgrupadorNode({ data }: NodeProps<Node<AgrupadorNodeData>>) {
  const { nombre, cantidad, dimmed } = data;
  return (
    <div style={{
      minWidth: 120, padding: "6px 12px",
      background: `${ACCENT}18`, border: `1px solid ${ACCENT}55`,
      borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
      opacity: dimmed ? 0.1 : 1, transition: "opacity 0.12s",
    }}>
      <Handle type="target" position={Position.Left}  style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, textAlign: "center" }}>{nombre}</div>
      <div style={{ fontSize: 9, color: ACCENT, opacity: 0.7 }}>{cantidad} opciones</div>
      <Handle type="source" position={Position.Right} style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

// ── TransitiveEdge ────────────────────────────────────────────────────────────
export function TransitiveEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, data,
}: EdgeProps<Edge<{ path?: string }>>) {
  const [hovered, setHovered] = useState(false);
  // Bezier with extra curvature, not smoothstep — keeps transitive edges from
  // tracing the same orthogonal routes as direct edges, where they'd be
  // visually indistinguishable from one another.
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.6,
  });

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {/* Invisible wider hit area to make hover easier to trigger */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ cursor: "default" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && data?.path && (
        <foreignObject x={midX - 100} y={midY - 20} width={200} height={1} style={{ overflow: "visible", pointerEvents: "none" }}>
          <div style={{
            background: "rgba(10,14,40,0.95)",
            border: "1px solid rgba(251,146,60,0.45)",
            borderRadius: 7, padding: "5px 9px", fontSize: 10,
            color: "rgba(251,146,60,0.9)", lineHeight: 1.4,
            width: 200, whiteSpace: "normal", wordBreak: "break-word", backdropFilter: "blur(8px)",
          }}>
            {data.path}
          </div>
        </foreignObject>
      )}
    </>
  );
}

export const nodeTypes = { materia: MateriaNode, agrupador: AgrupadorNode };
export const edgeTypes = { transitive: TransitiveEdge };
