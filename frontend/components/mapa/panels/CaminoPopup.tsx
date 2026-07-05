"use client";

import { useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant, ReactFlowProvider,
  BaseEdge, getSmoothStepPath, Handle, Position,
  type Node, type Edge, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Materia } from "@/app/types/plan";
import { GLASS, TEXT, TEXT_SEC } from "@/lib/ui/tokens";
import {
  STATE_STYLE, posicionarTopologico, NODE_W, NODE_H,
  type VisualEstado,
} from "@/lib/mapa/graphUtils";

type CaminoMateria = { id: string; nombre: string; dist: number; directa: boolean; ve: VisualEstado };

type Props = {
  focalId: string;
  focalNombre: string;
  caminoMaterias: CaminoMateria[];
  baseEdges: Edge[];
  onClose: () => void;
};

// ── Minimal node: no state chip, no horas — just the name, colored by estado.
type MiniNodeData = { label: string; ve: VisualEstado; isFocal: boolean };

function MiniMateriaNode({ data }: NodeProps<Node<MiniNodeData>>) {
  const { label, ve, isFocal } = data;
  const s = STATE_STYLE[ve];
  return (
    <div style={{
      width: NODE_W, minHeight: NODE_H, padding: "10px 12px",
      background: s.bg,
      border: isFocal ? `2px solid ${s.text}` : `1px solid ${s.border}`,
      borderRadius: 10, display: "flex", alignItems: "center",
      boxShadow: isFocal ? `0 0 0 3px ${s.text}44` : "none",
    }}>
      <Handle type="target" position={Position.Top} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word" }}>{label}</span>
      <Handle type="source" position={Position.Bottom} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

// ── Edge: violet solid = direct correlativa, amber solid = indirect leg.
// Step path (not bezier) with a per-edge horizontal offset — when several
// edges converge on the same target (a materia with 3-4 direct correlativas),
// a shared bezier endpoint makes them overlap into what looks like one line.
// Spreading the entry point by sibling index keeps each edge visually
// distinct even at the convergence point.
function CaminoEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps<Edge<{ directa: boolean; offset: number }>>) {
  const offset = data?.offset ?? 0;
  const [path] = getSmoothStepPath({
    sourceX: sourceX + offset, sourceY, sourcePosition,
    targetX: targetX + offset, targetY, targetPosition,
    borderRadius: 8,
  });
  const directa = data?.directa;
  return (
    <BaseEdge
      path={path}
      style={{
        stroke: directa ? "rgba(157,78,221,0.9)" : "#EF9F27",
        strokeWidth: 2, opacity: 1,
      }}
    />
  );
}

const nodeTypes = { materia: MiniMateriaNode };
const edgeTypes = { camino: CaminoEdge };

function CaminoPopupInner({ focalId, focalNombre, caminoMaterias, baseEdges, onClose }: Props) {
  const { nodes, edges } = useMemo(() => {
    const ids = [focalId, ...caminoMaterias.map((m) => m.id)];
    const idSet = new Set(ids);
    const directaSet = new Set(caminoMaterias.filter((m) => m.directa).map((m) => m.id));

    const realEdges = baseEdges.filter(
      (e) => !e.data?.isTransitive && idSet.has(e.source) && idSet.has(e.target),
    );

    const posMap = posicionarTopologico(ids, realEdges);

    const veById = new Map<string, VisualEstado>(caminoMaterias.map((m) => [m.id, m.ve]));

    const flowNodes: Node[] = ids.map((id) => ({
      id, type: "materia",
      position: posMap.get(id) ?? { x: 0, y: 0 },
      data: {
        label: id === focalId ? focalNombre : caminoMaterias.find((m) => m.id === id)?.nombre ?? id,
        ve: id === focalId ? "bloqueada" : veById.get(id) ?? "bloqueada",
        isFocal: id === focalId,
      } satisfies MiniNodeData,
    }));

    const bySourceThenTarget = [...realEdges].sort((a, b) => a.source.localeCompare(b.source));
    const countByTarget = new Map<string, number>();
    for (const e of bySourceThenTarget) countByTarget.set(e.target, (countByTarget.get(e.target) ?? 0) + 1);
    const seenByTarget = new Map<string, number>();

    const OFFSET_STEP = 14;
    const flowEdges: Edge[] = bySourceThenTarget.map((e) => {
      const total = countByTarget.get(e.target) ?? 1;
      const idx = seenByTarget.get(e.target) ?? 0;
      seenByTarget.set(e.target, idx + 1);
      const offset = (idx - (total - 1) / 2) * OFFSET_STEP;
      return {
        ...e,
        type: "camino",
        data: { directa: directaSet.has(e.source) && e.target === focalId, offset },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [focalId, focalNombre, caminoMaterias, baseEdges]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(15,20,50,0.97)", border: `1px solid ${GLASS.raised}`,
          borderRadius: 16, width: "min(900px, 95vw)", height: "min(600px, 85vh)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${GLASS.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Camino hacia {focalNombre}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            fitView fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3} maxZoom={2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            panOnScroll zoomOnPinch panOnDrag
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function CaminoPopup(props: Props) {
  return (
    <ReactFlowProvider>
      <CaminoPopupInner {...props} />
    </ReactFlowProvider>
  );
}
