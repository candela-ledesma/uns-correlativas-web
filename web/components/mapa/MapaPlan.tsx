"use client";

import { useMemo } from "react";
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
import { STATUS_COLORS, GLASS, TEXT, TEXT_SEC, TEXT_DET, ACCENT } from "@/lib/ui/tokens";

type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
};

// ── Layout constants ────────────────────────────────────────────────────────
// Layout: columns = year+semester (left→right), rows = slot within column (top→bottom)
const NODE_W  = 160;
const NODE_H  = 70;
const GAP_X   = 56;  // horizontal gap between columns (semesters)
const GAP_Y   = 20;  // vertical gap between nodes in same column
const COL_W   = NODE_W + GAP_X;
const ROW_H   = NODE_H + GAP_Y;

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

// ── Custom nodes ─────────────────────────────────────────────────────────────
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

type AgrupadorNodeData = { nombre: string; cantidad: number };

function AgrupadorNode({ data }: NodeProps<Node<AgrupadorNodeData>>) {
  const { nombre, cantidad } = data;
  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        background: "rgba(157,78,221,0.08)",
        border: `1.5px dashed rgba(157,78,221,0.45)`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        backdropFilter: "blur(8px)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: ACCENT, width: 8, height: 8, border: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, lineHeight: 1.3, wordBreak: "break-word" }}>
        {nombre}
      </div>
      <span
        style={{
          fontSize: 9,
          color: TEXT_SEC,
          marginTop: "auto",
        }}
      >
        {cantidad} {cantidad === 1 ? "opción" : "opciones"}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ background: ACCENT, width: 8, height: 8, border: "none" }} />
    </div>
  );
}

const nodeTypes = { materia: MateriaNode, agrupador: AgrupadorNode };

// ── Build nodes & edges ──────────────────────────────────────────────────────
function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>
): { nodes: Node[]; edges: Edge[] } {
  const materiaById = new Map(materias.map((m) => [String(m.id), m]));

  // Materias normales: excluir agrupadores y opciones dentro de un grupo
  const normales = materias.filter(
    (m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion && m.año && m.cuatrimestre
  );

  // Agrupadores con año/cuatrimestre deducido de su primera opción
  type AgrupadorConUbicacion = Agrupador & { año: string; cuatrimestre: string };
  const agrupadorItems: AgrupadorConUbicacion[] = agrupadores
    .map((a) => {
      const primera = a.opciones
        .map((id) => materiaById.get(String(id)))
        .find((m) => m?.año && m.cuatrimestre);
      if (!primera) return null;
      return { ...a, año: primera.año!, cuatrimestre: primera.cuatrimestre! };
    })
    .filter((a): a is AgrupadorConUbicacion => a !== null);

  // ── Column layout: each (año, cuatrimestre) pair = one vertical column ──────
  // Columns go left→right ordered by year then semester.
  // Within each column nodes stack top→bottom.

  // Build ordered list of unique (año, cuatrimestre) columns
  type ColKey = string; // `${año}|${cuatrimestre}`
  const colOrder: ColKey[] = [];
  const colSet = new Set<ColKey>();

  // Collect all (año, cuatrimestre) pairs from normales + agrupadores, sort them
  const allPairs: Array<{ año: string; cuatrimestre: string }> = [
    ...normales.map((m) => ({ año: m.año!, cuatrimestre: m.cuatrimestre! })),
    ...agrupadorItems.map((a) => ({ año: a.año, cuatrimestre: a.cuatrimestre })),
  ];

  // Sort: by year numerically (extract leading number), then by semester numerically
  const extractNum = (s: string) => {
    const match = s.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const uniquePairs = Array.from(
    new Map(allPairs.map((p) => [`${p.año}|${p.cuatrimestre}`, p])).values()
  ).sort((a, b) => {
    const yearDiff = extractNum(a.año) - extractNum(b.año);
    if (yearDiff !== 0) return yearDiff;
    return extractNum(a.cuatrimestre) - extractNum(b.cuatrimestre);
  });

  for (const p of uniquePairs) {
    const key: ColKey = `${p.año}|${p.cuatrimestre}`;
    if (!colSet.has(key)) { colSet.add(key); colOrder.push(key); }
  }

  const colIndex = new Map(colOrder.map((k, i) => [k, i]));

  // Assign each node to its column, track row counter per column
  const colRowCount = new Map<ColKey, number>();
  const posMap = new Map<string, { x: number; y: number }>();

  const assignPos = (id: string, año: string, cuatrimestre: string) => {
    const key: ColKey = `${año}|${cuatrimestre}`;
    const col = colIndex.get(key) ?? 0;
    const row = colRowCount.get(key) ?? 0;
    colRowCount.set(key, row + 1);
    posMap.set(id, { x: col * COL_W, y: row * ROW_H });
  };

  for (const m of normales)       assignPos(String(m.id), m.año!, m.cuatrimestre!);
  for (const a of agrupadorItems) assignPos(String(a.id), a.año, a.cuatrimestre);

  // Nodes: normales
  const normalNodes: Node[] = normales.map((m) => {
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

  // Nodes: agrupadores (placeholders)
  const agrupadorNodes: Node[] = agrupadorItems.map((a) => ({
    id: String(a.id),
    type: "agrupador",
    position: posMap.get(String(a.id)) ?? { x: 0, y: 0 },
    data: {
      nombre: a.nombre,
      cantidad: a.opciones.length,
    } satisfies AgrupadorNodeData,
  }));

  const nodes = [...normalNodes, ...agrupadorNodes];

  // Edges: from correlativas of normales only (source must be a normal node)
  const visibleIds = new Set([
    ...normales.map((m) => String(m.id)),
    ...agrupadorItems.map((a) => String(a.id)),
  ]);
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();

  for (const m of normales) {
    const targetId = String(m.id);
    for (const [reqId] of Object.entries(m.correlativas ?? {})) {
      if (!visibleIds.has(reqId)) continue;
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
              if (node.type === "agrupador") return ACCENT;
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
