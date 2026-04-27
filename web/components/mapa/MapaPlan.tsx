"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/plan/materiaViewModel";
import { STATUS_COLORS, GLASS, TEXT, TEXT_SEC, TEXT_DET } from "@/lib/ui/tokens";

type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

// ── Layout constants ────────────────────────────────────────────────────────
const NODE_W   = 160;
const NODE_H   = 70;
const GAP_X    = 48;
const GAP_Y    = 32;
const COL_W    = NODE_W + GAP_X;
const ROW_H    = NODE_H + GAP_Y;
const YEAR_GAP = 56; // extra vertical gap between years

// ── Visual state → colors ───────────────────────────────────────────────────
function resolveVisualState(vm: ReturnType<typeof getMateriaViewModel>) {
  if (vm.estado === "aprobada")  return STATUS_COLORS.aprobada;
  if (vm.estado === "cursada")   return STATUS_COLORS.cursada;
  if (vm.bloqueada)              return null; // use glass
  if (vm.puedeCursar)           return STATUS_COLORS.disponible;
  return null;
}

function getLabel(vm: ReturnType<typeof getMateriaViewModel>) {
  if (vm.estado === "aprobada")  return "Aprobada";
  if (vm.estado === "cursada")   return "Cursada";
  if (vm.bloqueada)              return "Bloqueada";
  if (vm.puedeCursar)           return "Disponible";
  return "";
}

// ── Custom node ─────────────────────────────────────────────────────────────
type NodeData = {
  label: string;
  horas: string;
  visualState: ReturnType<typeof resolveVisualState>;
  bloqueada: boolean;
  stateLabel: string;
};

function MateriaNode({ data }: NodeProps<Node<NodeData>>) {
  const { label, horas, visualState, bloqueada, stateLabel } = data;

  const border = visualState
    ? `1px solid ${visualState.cardBorder}`
    : `1px solid ${GLASS.raised}`;
  const bg = visualState ? visualState.cardBg : GLASS.faint;
  const accentColor = visualState ? visualState.accent : TEXT_SEC;

  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        background: bg,
        border,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        opacity: bloqueada ? 0.55 : 1,
        backdropFilter: "blur(8px)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: accentColor, width: 8, height: 8, border: "none" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word" }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        {stateLabel ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: accentColor,
              background: visualState ? visualState.badgeBg : GLASS.base,
              border: `1px solid ${visualState ? visualState.badgeBorder : GLASS.border}`,
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            {stateLabel}
          </span>
        ) : <span />}
        <span style={{ fontSize: 9, color: TEXT_DET }}>{horas}h</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: accentColor, width: 8, height: 8, border: "none" }} />
    </div>
  );
}

const nodeTypes = { materia: MateriaNode };

// ── Build nodes & edges ──────────────────────────────────────────────────────
function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>
): { nodes: Node[]; edges: Edge[] } {
  // Only real materias (no agrupadores), with year/cuatrimestre
  const real = materias.filter(
    (m) => !idsAgrupadores.has(String(m.id)) && m.año && m.cuatrimestre
  );

  // Group by year then semester for layout
  type Grid = Map<string, Map<string, Materia[]>>;
  const grid: Grid = new Map();
  for (const m of real) {
    const year = m.año!;
    const sem  = m.cuatrimestre!;
    if (!grid.has(year)) grid.set(year, new Map());
    if (!grid.get(year)!.has(sem)) grid.get(year)!.set(sem, []);
    grid.get(year)!.get(sem)!.push(m);
  }

  // Sort years and semesters
  const sortedYears = [...grid.keys()].sort((a, b) => Number(a) - Number(b));

  // Compute Y offset per (year, sem) block
  type SlotInfo = { x: number; y: number };
  const posMap = new Map<string, SlotInfo>();

  let yOffset = 0;

  for (const year of sortedYears) {
    const semMap = grid.get(year)!;
    const sortedSems = [...semMap.keys()].sort((a, b) => Number(a) - Number(b));

    for (const sem of sortedSems) {
      const items = semMap.get(sem)!;
      items.forEach((m, idx) => {
        posMap.set(String(m.id), { x: idx * COL_W, y: yOffset });
      });
      yOffset += ROW_H;
    }
    yOffset += YEAR_GAP;
  }

  const nodes: Node[] = real.map((m) => {
    const vm = getMateriaViewModel({ materia: m, estados, agrupadores, idsAgrupadores });
    const visualState = resolveVisualState(vm);
    const pos = posMap.get(String(m.id)) ?? { x: 0, y: 0 };

    return {
      id: String(m.id),
      type: "materia",
      position: pos,
      data: {
        label: m.nombre,
        horas: m.horas ?? "?",
        visualState,
        bloqueada: vm.bloqueada,
        stateLabel: getLabel(vm),
      } satisfies NodeData,
    };
  });

  // Build edges from correlativas
  const realIds = new Set(real.map((m) => String(m.id)));
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();

  for (const m of real) {
    const targetId = String(m.id);
    for (const [reqId] of Object.entries(m.correlativas ?? {})) {
      if (!realIds.has(reqId)) continue;
      const edgeId = `${reqId}->${targetId}`;
      if (edgeSeen.has(edgeId)) continue;
      edgeSeen.add(edgeId);

      edges.push({
        id: edgeId,
        source: reqId,
        target: targetId,
        type: "smoothstep",
        style: { stroke: "rgba(157,78,221,0.45)", strokeWidth: 1.5 },
        animated: false,
      });
    }
  }

  return { nodes, edges };
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MapaPlan({ materias, agrupadores, idsAgrupadores, estados }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(materias, agrupadores, idsAgrupadores, estados),
    [materias, agrupadores, idsAgrupadores, estados]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Legend items
  const legend = [
    { label: "Aprobada",   color: STATUS_COLORS.aprobada.accent },
    { label: "Cursada",    color: STATUS_COLORS.cursada.accent },
    { label: "Disponible", color: STATUS_COLORS.disponible.accent },
    { label: "Bloqueada",  color: TEXT_SEC },
  ];

  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {legend.map(({ label, color }) => (
          <span
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: TEXT_SEC,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: TEXT_SEC, marginLeft: "auto" }}>
          Arrastrá para mover · scroll para zoom
        </span>
      </div>

      {/* Flow container */}
      <div
        style={{
          width: "100%",
          height: "72vh",
          minHeight: 480,
          borderRadius: 14,
          overflow: "hidden",
          border: `1px solid ${GLASS.raised}`,
          background: "rgba(15,20,50,0.55)",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="rgba(255,255,255,0.06)"
          />
          <Controls
            style={{
              background: GLASS.base,
              border: `1px solid ${GLASS.raised}`,
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={(node) => {
              const d = node.data as NodeData;
              return d.visualState ? d.visualState.accent : TEXT_SEC;
            }}
            style={{
              background: "rgba(15,20,50,0.8)",
              border: `1px solid ${GLASS.raised}`,
              borderRadius: 8,
            }}
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
