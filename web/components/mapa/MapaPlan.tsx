"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useEdges,
  useReactFlow,
  ReactFlowProvider,
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
import { GLASS, TEXT, TEXT_SEC, TEXT_DET, ACCENT } from "@/lib/ui/tokens";
import { extractOrientaciones, passesOrientationFilter } from "@/lib/plan/kanbanUtils";

// ── Props ────────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  reglamentoUrl?: string | null;
  onVerEnPlan?: (materiaId: string) => void;
};

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 70;
const GAP_X  = 56;
const GAP_Y  = 20;
const COL_W  = NODE_W + GAP_X;
const ROW_H  = NODE_H + GAP_Y;

// ── Colors ───────────────────────────────────────────────────────────────────
const AMBER = { border: "#EF9F27", text: "#FAC775", bg: "rgba(239,159,39,0.12)", bgStrong: "rgba(186,117,23,0.12)" };

const STATE_STYLE = {
  aprobada:  { bg: "#3B6D11",               text: "#97C459", border: "rgba(151,196,89,0.5)"  },
  cursada:   { bg: "#185FA5",               text: "#85B7EB", border: "rgba(133,183,235,0.5)" },
  disponible:{ bg: "#534AB7",               text: "#AFA9EC", border: "rgba(175,169,236,0.5)" },
  bloqueada: { bg: "rgba(255,255,255,0.04)", text: "#9CA3AF", border: "rgba(255,255,255,0.12)"},
} as const;

type VisualEstado = keyof typeof STATE_STYLE;

function getVisualEstado(vm: ReturnType<typeof getMateriaViewModel>): VisualEstado {
  if (vm.estado === "aprobada") return "aprobada";
  if (vm.estado === "cursada")  return "cursada";
  if (vm.bloqueada)             return "bloqueada";
  if (vm.puedeCursar)           return "disponible";
  return "bloqueada";
}

function getStateLabel(ve: VisualEstado) {
  return ve === "aprobada" ? "Aprobada"
    : ve === "cursada"     ? "Cursada"
    : ve === "disponible"  ? "Disponible"
    : "Bloqueada";
}

// ── Traversal ────────────────────────────────────────────────────────────────
function getAncestors(nodeId: string, edges: Edge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.target === cur && !result.has(e.source)) { result.add(e.source); queue.push(e.source); }
    }
  }
  return result;
}

function getDescendants(nodeId: string, edges: Edge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.source === cur && !result.has(e.target)) { result.add(e.target); queue.push(e.target); }
    }
  }
  return result;
}

// ── Best-path algorithm ───────────────────────────────────────────────────────
type OptMode = "materias" | "cuatrimestres" | "horas";

type BestPathResult = {
  camino: string[];        // all ids in topological order
  pendientes: string[];    // ids not yet aprobada
  destino: string;
  totalPendientes: number;
  cuatrimestresEstimados: number;
};

function calcularMejorCamino(
  nodes: Node[],
  edges: Edge[],
  vmById: Map<string, VisualEstado>,
  materiaById: Map<string, Materia>,
  mode: OptMode,
): BestPathResult | null {
  if (nodes.length === 0) return null;

  // Paso 1: adjacency maps
  const sucesores: Record<string, string[]>   = {};
  const predecesores: Record<string, string[]> = {};
  for (const n of nodes) { sucesores[n.id] = []; predecesores[n.id] = []; }
  for (const e of edges) {
    sucesores[e.source]?.push(e.target);
    predecesores[e.target]?.push(e.source);
  }

  // Paso 2: leaf nodes (no outgoing edges) → pick the one with MOST ancestors
  const nodosHoja = nodes.filter((n) => sucesores[n.id].length === 0);
  if (nodosHoja.length === 0) return null;

  const contarAntecesores = (id: string): number => {
    const visited = new Set<string>();
    const q = [id];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const p of (predecesores[cur] ?? [])) {
        if (!visited.has(p)) { visited.add(p); q.push(p); }
      }
    }
    return visited.size;
  };

  // Score for mode selection (among leaf candidates)
  const scoreLeaf = (leafId: string, ancestorSet: Set<string>): number => {
    const all = [leafId, ...Array.from(ancestorSet)];
    const pending = all.filter((id) => vmById.get(id) !== "aprobada");
    if (mode === "horas") {
      return pending.reduce((acc, id) => acc + (parseFloat(materiaById.get(id)?.horas ?? "0") || 0), 0);
    }
    if (mode === "cuatrimestres") {
      // estimate levels for pending in this subgraph
      const pendSet = new Set(pending);
      const inDeg2 = new Map<string, number>();
      for (const id of pending) inDeg2.set(id, 0);
      for (const e of edges) {
        if (pendSet.has(e.source) && pendSet.has(e.target)) inDeg2.set(e.target, (inDeg2.get(e.target) ?? 0) + 1);
      }
      let lvl = 0; let cur2 = [...inDeg2.entries()].filter(([, d]) => d === 0).map(([id]) => id);
      while (cur2.length > 0) {
        lvl++;
        const nxt: string[] = [];
        for (const c of cur2) for (const e of edges) if (e.source === c && pendSet.has(e.target)) {
          const d = (inDeg2.get(e.target) ?? 0) - 1; inDeg2.set(e.target, d); if (d === 0) nxt.push(e.target);
        }
        cur2 = nxt;
      }
      return lvl;
    }
    return pending.length; // "materias" — default
  };

  // For "materias" mode, pick leaf with MOST ancestors (true end-of-career).
  // For other modes, pick leaf with best score.
  let destino = nodosHoja[0];
  if (mode === "materias") {
    let maxAnc = -1;
    for (const n of nodosHoja) {
      const c = contarAntecesores(n.id);
      if (c > maxAnc) { maxAnc = c; destino = n; }
    }
  } else {
    let bestScore = Infinity;
    for (const n of nodosHoja) {
      const anc = new Set<string>();
      const q = [n.id];
      while (q.length > 0) {
        const cur = q.shift()!;
        for (const p of (predecesores[cur] ?? [])) if (!anc.has(p)) { anc.add(p); q.push(p); }
      }
      const s = scoreLeaf(n.id, anc);
      if (s < bestScore) { bestScore = s; destino = n; }
    }
  }

  // Paso 3: BFS inverso desde destino — sin saltear aprobados
  const todosAntecesores = new Set<string>();
  const bfsQ = [destino.id];
  while (bfsQ.length > 0) {
    const cur = bfsQ.shift()!;
    for (const p of (predecesores[cur] ?? [])) {
      if (!todosAntecesores.has(p)) { todosAntecesores.add(p); bfsQ.push(p); }
    }
  }
  todosAntecesores.add(destino.id);

  // Paso 4: Kahn topological sort sobre el subgrafo completo
  const subNodos = Array.from(todosAntecesores);
  const inDeg = new Map<string, number>();
  for (const id of subNodos) {
    inDeg.set(id, (predecesores[id] ?? []).filter((p) => todosAntecesores.has(p)).length);
  }
  const cola: string[] = subNodos.filter((id) => inDeg.get(id) === 0);
  const ordenTopologico: string[] = [];
  while (cola.length > 0) {
    const cur = cola.shift()!;
    ordenTopologico.push(cur);
    for (const s of (sucesores[cur] ?? [])) {
      if (!todosAntecesores.has(s)) continue;
      const d = (inDeg.get(s) ?? 0) - 1;
      inDeg.set(s, d);
      if (d === 0) cola.push(s);
    }
  }

  // Paso 5: nivel topológico para estimar cuatrimestres
  const nivel: Record<string, number> = {};
  for (const id of ordenTopologico) {
    const predsEnSub = (predecesores[id] ?? []).filter((p) => todosAntecesores.has(p));
    nivel[id] = predsEnSub.length === 0 ? 0 : Math.max(...predsEnSub.map((p) => nivel[p] ?? 0)) + 1;
  }
  const maxNivel = ordenTopologico.length > 0 ? Math.max(...ordenTopologico.map((id) => nivel[id] ?? 0)) : 0;

  // Paso 6: separar pendientes
  const pendientes = ordenTopologico.filter((id) => vmById.get(id) !== "aprobada");

  return {
    camino: ordenTopologico,
    pendientes,
    destino: destino.id,
    totalPendientes: pendientes.length,
    cuatrimestresEstimados: maxNivel + 1,
  };
}

function hasHorasData(materiaById: Map<string, Materia>): boolean {
  for (const [, m] of materiaById) {
    const h = parseFloat(m.horas ?? "");
    if (h > 0) return true;
  }
  return false;
}

// ── Node data types ───────────────────────────────────────────────────────────
type NodeData = { label: string; horas: string; visualEstado: VisualEstado; highlighted: boolean; dimmed: boolean; hasAviso: boolean };
type AgrupadorNodeData = { nombre: string; cantidad: number; dimmed: boolean };

// ── Custom node: materia ──────────────────────────────────────────────────────
function MateriaNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { label, horas, visualEstado, highlighted, dimmed, hasAviso } = data;
  const s = STATE_STYLE[visualEstado];
  const baseOpacity = dimmed ? 0.1 : visualEstado === "bloqueada" ? 0.35 : 1;
  const ringBorder = highlighted ? `2px solid ${s.text}` : `1px solid ${s.border}`;
  const shadow = highlighted ? `0 0 0 3px ${s.text}44` : "none";

  return (
    <div
      data-ve={visualEstado}
      style={{
        width: NODE_W, minHeight: NODE_H,
        background: s.bg,
        borderTop: selected ? `2px solid ${s.text}` : ringBorder,
        borderRight: selected ? `2px solid ${s.text}` : ringBorder,
        borderBottom: selected ? `2px solid ${s.text}` : ringBorder,
        borderLeft: `3px solid ${s.text}`,
        borderRadius: 10, padding: "8px 10px",
        display: "flex", flexDirection: "column", gap: 4,
        opacity: baseOpacity, backdropFilter: "blur(8px)",
        boxShadow: shadow, transition: "opacity 0.12s, box-shadow 0.12s",
        cursor: "pointer", pointerEvents: "all", position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      {hasAviso && (
        <span title="Puede tener requisitos adicionales no reflejados en el plan" style={{ position: "absolute", top: 5, right: 8, fontSize: 10, lineHeight: 1, pointerEvents: "none", opacity: 0.85 }}>⚠</span>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word", pointerEvents: "none", paddingRight: hasAviso ? 14 : 0 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", pointerEvents: "none" }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: s.text, background: `${s.bg}99`, border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 5px" }}>
          {getStateLabel(visualEstado)}
        </span>
        <span style={{ fontSize: 9, color: TEXT_DET }}>{horas}h</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

// ── Custom node: agrupador ────────────────────────────────────────────────────
function AgrupadorNode({ data }: NodeProps<Node<AgrupadorNodeData>>) {
  const { nombre, cantidad, dimmed } = data;
  return (
    <div style={{
      width: NODE_W, minHeight: NODE_H,
      background: "rgba(157,78,221,0.08)", border: "1.5px dashed rgba(157,78,221,0.45)",
      borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4,
      backdropFilter: "blur(8px)", opacity: dimmed ? 0.1 : 1, transition: "opacity 0.12s", pointerEvents: "all",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, lineHeight: 1.3, wordBreak: "break-word", pointerEvents: "none" }}>{nombre}</div>
      <span style={{ fontSize: 9, color: TEXT_SEC, marginTop: "auto", pointerEvents: "none" }}>
        {cantidad} {cantidad === 1 ? "opción" : "opciones"}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

const nodeTypes = { materia: MateriaNode, agrupador: AgrupadorNode };

// ── Layout types ──────────────────────────────────────────────────────────────
type LayoutMode = "cuatrimestre" | "topologico";

// ── Topological layout ────────────────────────────────────────────────────────
function calcularNivelTopologico(ids: string[], edges: Edge[]): Map<string, number> {
  const idSet = new Set(ids);
  const inDeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
    }
  }
  const nivel = new Map<string, number>();
  const cola = ids.filter((id) => (inDeg.get(id) ?? 0) === 0);
  for (const id of cola) nivel.set(id, 0);

  while (cola.length > 0) {
    const cur = cola.shift()!;
    const lvl = nivel.get(cur) ?? 0;
    for (const e of edges) {
      if (e.source !== cur || !idSet.has(e.target)) continue;
      const next = inDeg.get(e.target)! - 1;
      inDeg.set(e.target, next);
      const newLvl = lvl + 1;
      if (!nivel.has(e.target) || newLvl > (nivel.get(e.target) ?? 0)) {
        nivel.set(e.target, newLvl);
      }
      if (next === 0) cola.push(e.target);
    }
  }
  // Fallback for nodes unreached (cycles or disconnected)
  for (const id of ids) {
    if (!nivel.has(id)) nivel.set(id, 0);
  }
  return nivel;
}

function posicionarTopologico(
  ids: string[],
  edges: Edge[],
): Map<string, { x: number; y: number }> {
  const nivel = calcularNivelTopologico(ids, edges);
  const porNivel = new Map<number, string[]>();
  for (const [id, lvl] of nivel) {
    if (!porNivel.has(lvl)) porNivel.set(lvl, []);
    porNivel.get(lvl)!.push(id);
  }

  const posMap = new Map<string, { x: number; y: number }>();
  for (const [lvl, nodos] of porNivel) {
    const totalAncho = nodos.length * NODE_W + (nodos.length - 1) * GAP_X;
    const offsetX = -totalAncho / 2;
    nodos.forEach((id, i) => {
      posMap.set(id, {
        x: offsetX + i * COL_W,
        y: lvl * ROW_H,
      });
    });
  }
  return posMap;
}

// ── Build graph ───────────────────────────────────────────────────────────────
// ── Edge colors ───────────────────────────────────────────────────────────────
// Color is driven by the source node (the prerequisite):
//   aprobada source → green  (requirement already met)
//   cursada  source → blue   (requirement in progress)
//   anything → target bloqueada → dim gray
//   otherwise → purple (default, unknown or disponible source)
const EDGE_COLOR = {
  aprobada:  { stroke: "rgba(151,196,89,0.7)",  strokeWidth: 1.5, opacity: 1    },
  cursada:   { stroke: "rgba(133,183,235,0.65)", strokeWidth: 1.5, opacity: 1    },
  bloqueada: { stroke: "rgba(255,255,255,0.10)", strokeWidth: 1,   opacity: 0.4  },
  default:   { stroke: "rgba(157,78,221,0.45)",  strokeWidth: 1.5, opacity: 1    },
} as const;

function getEdgeStyle(sourceVe: VisualEstado | undefined, targetVe: VisualEstado): CSSProperties {
  if (targetVe === "bloqueada") return EDGE_COLOR.bloqueada;
  if (sourceVe === "aprobada")  return EDGE_COLOR.aprobada;
  if (sourceVe === "cursada")   return EDGE_COLOR.cursada;
  return EDGE_COLOR.default;
}

function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>,
  selectedOrientacion: string,
  layoutMode: LayoutMode,
): { nodes: Node[]; edges: Edge[]; materiaById: Map<string, Materia>; vmById: Map<string, VisualEstado> } {
  const materiaById = new Map(materias.map((m) => [String(m.id), m]));

  const normales = materias.filter(
    (m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion && m.año && m.cuatrimestre
      && passesOrientationFilter(m, selectedOrientacion, idsAgrupadores, agrupadores)
  );

  type AgrupadorConUbicacion = Agrupador & { año: string; cuatrimestre: string };
  const agrupadorItems: AgrupadorConUbicacion[] = agrupadores
    .map((a) => {
      const agAsMat = { id: a.id } as Materia;
      if (!passesOrientationFilter(agAsMat, selectedOrientacion, idsAgrupadores, agrupadores)) return null;
      const primera = a.opciones.map((id) => materiaById.get(String(id))).find((m) => m?.año && m.cuatrimestre);
      if (!primera) return null;
      return { ...a, año: primera.año!, cuatrimestre: primera.cuatrimestre! };
    })
    .filter((a): a is AgrupadorConUbicacion => a !== null);

  const extractNum = (s: string) => { const m = s.match(/\d+/); return m ? parseInt(m[0], 10) : 0; };

  const allPairs = [
    ...normales.map((m) => ({ año: m.año!, cuatrimestre: m.cuatrimestre! })),
    ...agrupadorItems.map((a) => ({ año: a.año, cuatrimestre: a.cuatrimestre })),
  ];
  const uniquePairs = Array.from(new Map(allPairs.map((p) => [`${p.año}|${p.cuatrimestre}`, p])).values())
    .sort((a, b) => { const d = extractNum(a.año) - extractNum(b.año); return d !== 0 ? d : extractNum(a.cuatrimestre) - extractNum(b.cuatrimestre); });

  const colIndex = new Map(uniquePairs.map((p, i) => [`${p.año}|${p.cuatrimestre}`, i]));
  const colRowCount = new Map<string, number>();
  const cuatPosMap = new Map<string, { x: number; y: number }>();
  const assignPos = (id: string, año: string, cuatrimestre: string) => {
    const key = `${año}|${cuatrimestre}`;
    const col = colIndex.get(key) ?? 0;
    const row = colRowCount.get(key) ?? 0;
    colRowCount.set(key, row + 1);
    cuatPosMap.set(id, { x: col * COL_W, y: row * ROW_H });
  };
  for (const m of normales)       assignPos(String(m.id), m.año!, m.cuatrimestre!);
  for (const a of agrupadorItems) assignPos(String(a.id), a.año, a.cuatrimestre);

  const vmById = new Map<string, VisualEstado>();
  for (const m of normales) {
    const vm = getMateriaViewModel({ materia: m, estados, agrupadores, idsAgrupadores });
    vmById.set(String(m.id), getVisualEstado(vm));
  }

  const visibleIds = new Set([...normales.map((m) => String(m.id)), ...agrupadorItems.map((a) => String(a.id))]);
  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();
  for (const m of normales) {
    const targetId = String(m.id);
    const targetVe = vmById.get(targetId) ?? "bloqueada";
    for (const [reqId] of Object.entries(m.correlativas ?? {})) {
      if (!visibleIds.has(reqId)) continue;
      const edgeId = `${reqId}->${targetId}`;
      if (edgeSeen.has(edgeId)) continue;
      edgeSeen.add(edgeId);

      const sourceVe = vmById.get(reqId);
      const edgeStyle = getEdgeStyle(sourceVe, targetVe);

      edges.push({
        id: edgeId, source: reqId, target: targetId, type: "smoothstep",
        style: edgeStyle,
        animated: false,
      });
    }
  }

  // Compute final positions based on layout mode
  const topoIds = normales.map((m) => String(m.id));
  const topoPosMap = layoutMode === "topologico"
    ? posicionarTopologico(topoIds, edges)
    : null;

  const posMap = (id: string) =>
    layoutMode === "topologico"
      ? (topoPosMap!.get(id) ?? cuatPosMap.get(id) ?? { x: 0, y: 0 })
      : (cuatPosMap.get(id) ?? { x: 0, y: 0 });

  const nodes: Node[] = [
    ...normales.map((m) => {
    const hasAviso = Boolean(m.grupo_opcion) || m.nombre.toLowerCase().includes("tesis");
    return {
      id: String(m.id), type: "materia",
      position: posMap(String(m.id)),
      data: { label: m.nombre, horas: m.horas ?? "?", visualEstado: vmById.get(String(m.id)) ?? "bloqueada", highlighted: false, dimmed: false, hasAviso } satisfies NodeData,
    };
  }),
    ...agrupadorItems.map((a) => ({
      id: String(a.id), type: "agrupador",
      position: cuatPosMap.get(String(a.id)) ?? { x: 0, y: 0 },
      data: { nombre: a.nombre, cantidad: a.opciones.length, dimmed: false } satisfies AgrupadorNodeData,
    })),
  ];

  return { nodes, edges, materiaById, vmById };
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  nodeId, materias, idsAgrupadores, vmById, reglamentoUrl, onClose, onVerEnPlan,
}: {
  nodeId: string; materias: Materia[]; idsAgrupadores: Set<string>;
  vmById: Map<string, VisualEstado>;
  reglamentoUrl?: string | null;
  onClose: () => void; onVerEnPlan?: (materiaId: string) => void;
}) {
  const materiaById = useMemo(() => new Map(materias.map((m) => [String(m.id), m])), [materias]);
  const materia = materiaById.get(nodeId);
  if (!materia) return null;

  const ve = vmById.get(nodeId) ?? "bloqueada";
  const s = STATE_STYLE[ve];

  const requiere = Object.keys(materia.correlativas ?? {}).map((id) => ({
    id, nombre: materiaById.get(id)?.nombre ?? id, ve: vmById.get(id) ?? ("bloqueada" as VisualEstado),
  }));
  const habilita = materias
    .filter((m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion)
    .filter((m) => Object.keys(m.correlativas ?? {}).includes(nodeId))
    .map((m) => ({ id: String(m.id), nombre: m.nombre, ve: vmById.get(String(m.id)) ?? ("bloqueada" as VisualEstado) }));

  const hasAviso = Boolean(materia.grupo_opcion) || materia.nombre.toLowerCase().includes("tesis");

  const sectionTitle: React.CSSProperties = { fontSize: 10, color: TEXT_SEC, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" };
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
    <div style={{ background: "rgba(15,20,50,0.95)", border: `1px solid ${GLASS.raised}`, borderRadius: 12, padding: "14px 16px", width: 260, maxHeight: "70vh", overflowY: "auto", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, flex: 1 }}>{materia.nombre}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>
      <span style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 600, color: s.text, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: "2px 8px" }}>{getStateLabel(ve)}</span>
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
        <div style={{ background: "rgba(239,159,39,0.08)", border: `1px solid ${AMBER.border}44`, borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: AMBER.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            ⚠ Requisitos adicionales
          </div>
          <p style={{ fontSize: 11, color: TEXT_DET, lineHeight: 1.5, margin: 0 }}>
            Esta materia puede tener requisitos de porcentaje de carrera aprobada que no figuran en el plan. Verificá las condiciones actuales en la página del departamento antes de inscribirte.
          </p>
          {reglamentoUrl && (
            <a href={reglamentoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: AMBER.text, textDecoration: "underline", alignSelf: "flex-start" }}>
              Ver reglamento →
            </a>
          )}
        </div>
      )}
      {onVerEnPlan && (
        <button onClick={() => onVerEnPlan(nodeId)} style={{ background: "rgba(157,78,221,0.15)", border: "1px solid rgba(157,78,221,0.4)", borderRadius: 7, color: "#c4a0f0", fontSize: 11, fontWeight: 600, padding: "6px 10px", cursor: "pointer", textAlign: "center" }}>
          Ver en Plan
        </button>
      )}
    </div>
  );
}

// ── Best path panel ───────────────────────────────────────────────────────────
function BestPathPanel({
  result, materiaById, vmById, mode, onModeChange, onLimpiar, hasHoras,
}: {
  result: BestPathResult;
  materiaById: Map<string, Materia>;
  vmById: Map<string, VisualEstado>;
  mode: OptMode;
  onModeChange: (m: OptMode) => void;
  onLimpiar: () => void;
  hasHoras: boolean;
}) {
  const divider: React.CSSProperties = { borderTop: `1px solid ${GLASS.border}`, margin: "4px 0" };
  const pendingInCamino = result.pendientes;

  return (
    <div style={{
      background: "rgba(15,20,50,0.96)", border: `1px solid ${AMBER.border}`,
      borderRadius: 12, padding: "14px 16px", width: 272,
      maxHeight: "75vh", overflowY: "auto",
      backdropFilter: "blur(14px)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: AMBER.text, lineHeight: 1.3 }}>Mejor camino · fin de carrera</div>
          <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 2 }}>mínima cantidad de materias desde tu estado actual</div>
        </div>
        <button onClick={onLimpiar} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {(["materias", "cuatrimestres", "horas"] as OptMode[]).map((m) => {
          const label = m === "materias" ? "Menos materias" : m === "cuatrimestres" ? "Menos cuatrimestres" : "Menos carga horaria";
          const disabled = m === "horas" && !hasHoras;
          return (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
              title={disabled ? "Tu plan no incluye datos de carga horaria" : undefined}>
              <input type="radio" name="optMode" value={m} checked={mode === m} disabled={disabled}
                onChange={() => onModeChange(m)} style={{ accentColor: AMBER.border, cursor: disabled ? "not-allowed" : "pointer" }} />
              <span style={{ fontSize: 11, color: mode === m ? AMBER.text : TEXT_SEC }}>{label}</span>
            </label>
          );
        })}
      </div>

      <div style={divider} />

      {/* Camino list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {result.camino.map((id) => {
          const m = materiaById.get(id);
          const ve = vmById.get(id) ?? "bloqueada";
          const isPending = ve !== "aprobada";
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isPending ? AMBER.border : STATE_STYLE.aprobada.text, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isPending ? AMBER.text : TEXT_DET, lineHeight: 1.3, flex: 1 }}>
                {m?.nombre ?? id}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, borderRadius: 4, padding: "1px 5px",
                color: isPending ? AMBER.border : STATE_STYLE[ve].text,
                background: isPending ? AMBER.bg : `${STATE_STYLE[ve].bg}99`,
                border: `1px solid ${isPending ? AMBER.border : STATE_STYLE[ve].border}`,
                flexShrink: 0,
              }}>
                {isPending ? "pendiente" : getStateLabel(ve)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={divider} />

      {/* Metrics */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, background: AMBER.bgStrong, border: `1px solid ${AMBER.border}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AMBER.text }}>{pendingInCamino.length}</div>
          <div style={{ fontSize: 9, color: TEXT_SEC, marginTop: 2 }}>materias restantes</div>
        </div>
        <div style={{ flex: 1, background: AMBER.bgStrong, border: `1px solid ${AMBER.border}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: AMBER.text }}>{result.cuatrimestresEstimados}</div>
          <div style={{ fontSize: 9, color: TEXT_SEC, marginTop: 2 }}>cuatrimestres mín.</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled
          title="Próximamente"
          style={{ flex: 1, background: GLASS.base, border: `1px solid ${GLASS.border}`, borderRadius: 7, color: TEXT_SEC, fontSize: 11, fontWeight: 600, padding: "6px 8px", cursor: "not-allowed", opacity: 0.5 }}>
          Enviar al Planificador
        </button>
        <button onClick={onLimpiar} style={{ flex: 1, background: AMBER.bg, border: `1px solid ${AMBER.border}`, borderRadius: 7, color: AMBER.text, fontSize: 11, fontWeight: 600, padding: "6px 8px", cursor: "pointer" }}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
type FiltroEstado = "todas" | VisualEstado;

function Toolbar({
  filtro, onFiltro, busqueda, onBusqueda, contadores, onBuscar, layoutMode, onToggleLayout,
}: {
  filtro: FiltroEstado; onFiltro: (f: FiltroEstado) => void;
  busqueda: string; onBusqueda: (s: string) => void;
  contadores: Record<VisualEstado, number>; onBuscar: () => void;
  layoutMode: LayoutMode; onToggleLayout: () => void;
}) {
  const chips: { key: FiltroEstado; label: string }[] = [
    { key: "todas", label: "Todas" }, { key: "aprobada", label: "Aprobada" },
    { key: "cursada", label: "Cursada" }, { key: "disponible", label: "Disponible" },
    { key: "bloqueada", label: "Bloqueada" },
  ];
  const total = Object.values(contadores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: GLASS.dim, border: `1px solid ${GLASS.raised}`, borderRadius: 10 }}>
      <input
        type="text" placeholder="Buscar materia..." value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onBuscar()}
        style={{ background: GLASS.elevated, border: `1px solid ${GLASS.strong}`, borderRadius: 7, color: TEXT, fontSize: 12, padding: "5px 10px", outline: "none", width: 160 }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {chips.map(({ key, label }) => {
          const active = filtro === key;
          const accentColor = key === "todas" ? ACCENT : STATE_STYLE[key as VisualEstado].text;
          return (
            <button key={key} onClick={() => onFiltro(key)} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
              border: active ? `1px solid ${accentColor}` : `1px solid ${GLASS.border}`,
              background: active ? `${accentColor}22` : GLASS.base,
              color: active ? accentColor : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
            }}>
              {label}
              {key !== "todas" && <span style={{ marginLeft: 4, opacity: 0.7 }}>{contadores[key as VisualEstado]}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
        {(["cuatrimestre", "topologico"] as LayoutMode[]).map((mode) => {
          const active = layoutMode === mode;
          return (
            <button key={mode} onClick={onToggleLayout} title={mode === "cuatrimestre" ? "Agrupar por año y cuatrimestre" : "Posicionar por nivel de dependencias"} style={{
              fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
              border: active ? `1px solid ${ACCENT}` : `1px solid ${GLASS.border}`,
              background: active ? `${ACCENT}22` : GLASS.base,
              color: active ? ACCENT : TEXT_SEC, cursor: "pointer", transition: "all 0.1s",
            }}>
              {mode === "cuatrimestre" ? "Por cuatrimestre" : "Topológico"}
            </button>
          );
        })}
      </div>

      <span style={{ fontSize: 10, color: TEXT_SEC, marginLeft: "auto" }}>
        {contadores.aprobada} aprobadas · {contadores.cursada} cursando · {contadores.disponible} disponibles · {contadores.bloqueada} bloqueadas · {total} total
      </span>
    </div>
  );
}

// ── HoverStyleInjector ────────────────────────────────────────────────────────
function HoverStyleInjector({
  hoveredNodeId, activeChain, setEdges, baseEdges, caminoActivo,
}: {
  hoveredNodeId: string | null; activeChain: Set<string> | null;
  setEdges: (edges: Edge[]) => void; baseEdges: Edge[];
  caminoActivo: boolean;
}) {
  const liveEdges = useEdges();

  const css = useMemo(() => {
    if (caminoActivo) return ""; // camino mode handles its own CSS
    if (!hoveredNodeId || !activeChain) return "";
    const dimmed = `.react-flow__node:not([data-id="${Array.from(activeChain).join('"]):not([data-id="')}"]) { opacity: 0.06 !important; transition: opacity 0.12s; }`;
    const active = Array.from(activeChain).map((id) => `.react-flow__node[data-id="${id}"] { opacity: 1 !important; transition: opacity 0.12s; }`).join("");
    const hovered = `.react-flow__node[data-id="${hoveredNodeId}"] > div { box-shadow: 0 0 0 3px rgba(200,200,255,0.5) !important; }`;
    return dimmed + active + hovered;
  }, [hoveredNodeId, activeChain, caminoActivo]);

  useEffect(() => {
    if (caminoActivo) return; // camino mode handles edges separately
    if (!hoveredNodeId || !activeChain) { setEdges(baseEdges); return; }
    setEdges(liveEdges.map((e) => {
      const inChain = activeChain.has(e.source) && activeChain.has(e.target);
      return { ...e, style: inChain ? { stroke: "rgba(157,78,221,0.9)", strokeWidth: 2, opacity: 1 } : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 } };
    }));
  }, [hoveredNodeId, activeChain, caminoActivo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!css) return null;
  return <style>{css}</style>;
}

// ── CaminoStyleInjector ───────────────────────────────────────────────────────
function CaminoStyleInjector({
  caminoSet, vmById, setEdges, baseEdges,
}: {
  caminoSet: Set<string> | null; vmById: Map<string, VisualEstado>;
  setEdges: (edges: Edge[]) => void; baseEdges: Edge[];
}) {
  const liveEdges = useEdges();

  const css = useMemo(() => {
    if (!caminoSet) return "";
    const inCamino = Array.from(caminoSet);
    const notInCamino = `.react-flow__node:not([data-id="${inCamino.join('"]):not([data-id="')}"]) { opacity: 0.07 !important; transition: opacity 0.15s; }`;
    const styles = inCamino.map((id) => {
      const ve = vmById.get(id) ?? "bloqueada";
      if (ve === "aprobada") {
        // Green node + amber ring
        return `.react-flow__node[data-id="${id}"] { opacity: 1 !important; } .react-flow__node[data-id="${id}"] > div { box-shadow: 0 0 0 2px ${AMBER.border}, 0 0 8px rgba(239,159,39,0.25) !important; }`;
      }
      // Pending node: amber style
      return `.react-flow__node[data-id="${id}"] { opacity: 1 !important; } .react-flow__node[data-id="${id}"] > div { background: rgba(239,159,39,0.12) !important; border-color: ${AMBER.border} !important; box-shadow: 0 0 0 2px ${AMBER.border}, 0 0 8px rgba(239,159,39,0.25) !important; }`;
    }).join("");
    return notInCamino + styles;
  }, [caminoSet, vmById]);

  useEffect(() => {
    if (!caminoSet) { setEdges(baseEdges); return; }
    setEdges(liveEdges.map((e) => {
      const inPath = caminoSet.has(e.source) && caminoSet.has(e.target);
      return { ...e, style: inPath ? { stroke: AMBER.border, strokeWidth: 2, opacity: 1 } : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 } };
    }));
  }, [caminoSet]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!css) return null;
  return <style>{css}</style>;
}

// ── Inner component ───────────────────────────────────────────────────────────
function MapaInner({ materias, agrupadores, idsAgrupadores, estados, reglamentoUrl, onVerEnPlan }: Props) {
  const { fitView, getNodes, getNode, flowToScreenPosition } = useReactFlow();

  const [selectedOrientacion, setSelectedOrientacion] = useState("todas");
  const orientaciones = useMemo(() => extractOrientaciones(materias, agrupadores), [materias, agrupadores]);
  const hasOrientaciones = orientaciones.length > 0;

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") return "cuatrimestre";
    return (localStorage.getItem("mapaLayoutMode") as LayoutMode) ?? "cuatrimestre";
  });

  const [customPositions, setCustomPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const { nodes: baseNodes, edges: baseEdges, materiaById, vmById } = useMemo(
    () => buildGraph(materias, agrupadores, idsAgrupadores, estados, selectedOrientacion, layoutMode),
    [materias, agrupadores, idsAgrupadores, estados, selectedOrientacion, layoutMode]
  );

  const hasHoras = useMemo(() => hasHorasData(materiaById), [materiaById]);

  const [filtro, setFiltro]               = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda]           = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelSide, setPanelSide]         = useState<"left" | "right">("right");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [caminoActivo, setCaminoActivo]   = useState(false);
  const [optMode, setOptMode]             = useState<OptMode>("materias");
  const [minimapVisible, setMinimapVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("mapaMinimapVisible");
    return stored === null ? true : stored === "true";
  });

  const isTouchDevice = useRef(typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredDebounced = useCallback((id: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (id === null) { setHoveredNodeId(null); }
    else { hoverTimerRef.current = setTimeout(() => setHoveredNodeId(id), 30); }
  }, []);

  const bestPath = useMemo<BestPathResult | null>(() => {
    if (!caminoActivo) return null;
    return calcularMejorCamino(baseNodes, baseEdges, vmById, materiaById, optMode);
  }, [caminoActivo, baseNodes, baseEdges, vmById, materiaById, optMode]);

  const caminoSet = useMemo<Set<string> | null>(() => {
    if (!bestPath) return null;
    return new Set(bestPath.camino);
  }, [bestPath]);

  const activeChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || caminoActivo) return null;
    const chain = new Set<string>([hoveredNodeId]);
    for (const id of getAncestors(hoveredNodeId, baseEdges)) chain.add(id);
    for (const id of getDescendants(hoveredNodeId, baseEdges)) chain.add(id);
    return chain;
  }, [hoveredNodeId, baseEdges, caminoActivo]);

  const displayNodes = useMemo<Node[]>(() => {
    return baseNodes.map((n) => {
      const custom = customPositions.get(n.id);
      const position = custom ?? n.position;
      if (n.type === "agrupador") return { ...n, position, draggable: true, data: { ...n.data, dimmed: filtro !== "todas" } };
      const ve = vmById.get(n.id) ?? "bloqueada";
      const dimmed = filtro !== "todas" && ve !== filtro && !caminoActivo;
      const highlighted = n.id === highlightedId;
      return { ...n, position, data: { ...n.data, dimmed, highlighted }, selected: n.id === selectedNodeId };
    });
  }, [baseNodes, filtro, highlightedId, selectedNodeId, vmById, caminoActivo, customPositions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(displayNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);

  useEffect(() => { setNodes(displayNodes); }, [displayNodes, setNodes]);

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((v) => { const next = !v; localStorage.setItem("mapaMinimapVisible", String(next)); return next; });
  }, []);

  const contadores = useMemo<Record<VisualEstado, number>>(() => {
    const c: Record<VisualEstado, number> = { aprobada: 0, cursada: 0, disponible: 0, bloqueada: 0 };
    for (const [, ve] of vmById) c[ve]++;
    return c;
  }, [vmById]);

  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;
    setTimeout(() => {
      const activeIds = new Set([...vmById.entries()].filter(([, ve]) => ve === "disponible" || ve === "cursada").map(([id]) => id));
      if (activeIds.size > 0) fitView({ nodes: getNodes().filter((n) => activeIds.has(n.id)), padding: 0.35, duration: 400 });
      else fitView({ padding: 0.15, duration: 400 });
    }, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fitAll = useCallback(() => fitView({ padding: 0.15, duration: 400 }), [fitView]);

  const handleToggleLayout = useCallback(() => {
    setCustomPositions(new Map());
    setLayoutMode((prev) => {
      const next: LayoutMode = prev === "cuatrimestre" ? "topologico" : "cuatrimestre";
      localStorage.setItem("mapaLayoutMode", next);
      setTimeout(() => fitView({ padding: 0.15, duration: 450 }), 50);
      return next;
    });
  }, [fitView]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        fitAll();
      }
      if (e.key === "Escape") { setSelectedNodeId(null); setCaminoActivo(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitAll]);

  const handleBuscar = useCallback(() => {
    if (!busqueda.trim()) return;
    const q = busqueda.toLowerCase();
    const match = baseNodes.find((n) => n.type === "materia" && (n.data as NodeData).label.toLowerCase().includes(q));
    if (!match) return;
    setHighlightedId(match.id);
    setSelectedNodeId(match.id);
    fitView({ nodes: [match], padding: 0.5, duration: 500 });
    setTimeout(() => setHighlightedId(null), 2000);
  }, [busqueda, baseNodes, fitView]);

  const handleNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (isTouchDevice.current || node.type !== "materia" || caminoActivo) return;
    setHoveredDebounced(node.id);
  }, [setHoveredDebounced, caminoActivo]);

  const handleNodeMouseLeave = useCallback(() => {
    if (isTouchDevice.current) return;
    setHoveredDebounced(null);
  }, [setHoveredDebounced]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== "materia" || caminoActivo) return;
    setSelectedNodeId((prev) => {
      if (prev === node.id) return null;
      const flowNode = getNode(node.id);
      if (flowNode) {
        const screenPos = flowToScreenPosition({ x: flowNode.position.x, y: flowNode.position.y });
        const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
        setPanelSide(screenPos.x > vw / 2 ? "left" : "right");
      }
      return node.id;
    });
  }, [getNode, flowToScreenPosition, caminoActivo]);

  const handlePaneClick = useCallback(() => setSelectedNodeId(null), []);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    setCustomPositions((prev) => {
      const next = new Map(prev);
      for (const n of allNodes) {
        if (n.selected || n.id === _node.id) next.set(n.id, n.position);
      }
      return next;
    });
  }, []);

  const selectedMateria = selectedNodeId ? materiaById.get(selectedNodeId) : null;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div style={{ position: "relative" }}>
      {hasOrientaciones && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_SEC, flexShrink: 0 }}>Orientación:</span>
          <select
            value={selectedOrientacion}
            onChange={(e) => { setSelectedOrientacion(e.target.value); setSelectedNodeId(null); setCaminoActivo(false); }}
            style={{
              background: selectedOrientacion === "todas" ? GLASS.base : "rgba(157,78,221,0.15)",
              border: selectedOrientacion === "todas" ? `1px solid ${GLASS.raised}` : "1px solid rgba(157,78,221,0.45)",
              borderRadius: 7, color: selectedOrientacion === "todas" ? TEXT_SEC : "#c084fc",
              fontSize: 12, padding: "4px 10px", cursor: "pointer", outline: "none",
            }}>
            <option value="todas">Todas las orientaciones</option>
            {orientaciones.map((ori) => <option key={ori} value={ori}>{ori}</option>)}
          </select>
        </div>
      )}

      <Toolbar
        filtro={filtro} onFiltro={setFiltro}
        busqueda={busqueda} onBusqueda={setBusqueda}
        contadores={contadores} onBuscar={handleBuscar}
        layoutMode={layoutMode} onToggleLayout={handleToggleLayout}
      />

      <div style={{ width: "100%", height: "72vh", minHeight: 480, borderRadius: 14, overflow: "hidden", border: `1px solid ${caminoActivo ? AMBER.border : GLASS.raised}`, background: "rgba(15,20,50,0.55)", transition: "border-color 0.2s" }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable
          selectionOnDrag
          multiSelectionKeyCode="Shift"
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.35} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <HoverStyleInjector
            hoveredNodeId={hoveredNodeId} activeChain={activeChain}
            setEdges={setEdges} baseEdges={baseEdges} caminoActivo={caminoActivo}
          />
          <CaminoStyleInjector
            caminoSet={caminoSet} vmById={vmById}
            setEdges={setEdges} baseEdges={baseEdges}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />

          <Controls style={{ background: GLASS.base, border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}>
            <ControlButton onClick={fitAll} title="Ajustar vista (F)" style={{ fontSize: 11, fontWeight: 700, color: TEXT_SEC }}>F</ControlButton>
            <ControlButton onClick={toggleMinimap} title={minimapVisible ? "Ocultar minimapa" : "Mostrar minimapa"} style={{ fontSize: 9, fontWeight: 700, color: TEXT_SEC }}>
              {minimapVisible ? "▪" : "▫"}
            </ControlButton>
          </Controls>

          {minimapVisible && (
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "agrupador") return ACCENT;
                if (caminoSet?.has(node.id)) return AMBER.border;
                const ve = vmById.get(node.id) ?? "bloqueada";
                return STATE_STYLE[ve].text;
              }}
              style={{ background: "rgba(15,20,50,0.8)", border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}
              maskColor="rgba(0,0,0,0.4)"
            />
          )}

          {/* Detail panel */}
          {selectedMateria && selectedNodeId && !caminoActivo && (
            <Panel position={panelSide === "left" ? "top-left" : "top-right"}>
              <DetailPanel
                nodeId={selectedNodeId} materias={materias}
                idsAgrupadores={idsAgrupadores} vmById={vmById}
                reglamentoUrl={reglamentoUrl}
                onClose={() => setSelectedNodeId(null)} onVerEnPlan={onVerEnPlan}
              />
            </Panel>
          )}

          {/* Best path panel */}
          {caminoActivo && bestPath && (
            <Panel position={isMobile ? "bottom-center" : "top-left"}>
              <BestPathPanel
                result={bestPath} materiaById={materiaById} vmById={vmById}
                mode={optMode} onModeChange={setOptMode}
                onLimpiar={() => setCaminoActivo(false)} hasHoras={hasHoras}
              />
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function MapaPlan(props: Props) {
  return (
    <ReactFlowProvider>
      <MapaInner {...props} />
    </ReactFlowProvider>
  );
}
