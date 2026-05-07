import type { CSSProperties } from "react";
import type { Node, Edge } from "@xyflow/react";

import { Agrupador, Materia } from "@/app/types/plan";
import { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { getMateriaViewModel } from "@/lib/plan/materiaViewModel";
import { STATUS_COLORS } from "@/lib/ui/tokens";
import { passesOrientationFilter } from "@/lib/plan/kanbanUtils";

// ── Layout constants ──────────────────────────────────────────────────────────
export const NODE_W = 160;
export const NODE_H = 70;
export const GAP_X  = 56;
export const GAP_Y  = 20;
export const COL_W  = NODE_W + GAP_X;
export const ROW_H  = NODE_H + GAP_Y;

// ── Colors ────────────────────────────────────────────────────────────────────
export const AMBER = {
  border: "#EF9F27",
  text: "#FAC775",
  bg: "rgba(239,159,39,0.12)",
  bgStrong: "rgba(186,117,23,0.12)",
};

export const STATE_STYLE = {
  aprobada:  { bg: "rgba(144,190,109,0.30)", text: STATUS_COLORS.aprobada.accent,   border: STATUS_COLORS.aprobada.cardBorder   },
  cursada:   { bg: "rgba(76,201,240,0.25)",  text: STATUS_COLORS.cursada.accent,    border: STATUS_COLORS.cursada.cardBorder    },
  disponible:{ bg: "rgba(249,199,79,0.22)",  text: STATUS_COLORS.disponible.accent, border: STATUS_COLORS.disponible.cardBorder },
  bloqueada: { bg: "#2a2a3a",               text: "#888898",                       border: "#4a4a5a"                           },
} as const;

export type VisualEstado = keyof typeof STATE_STYLE;

export function getVisualEstado(vm: ReturnType<typeof getMateriaViewModel>): VisualEstado {
  if (vm.estado === "aprobada") return "aprobada";
  if (vm.estado === "cursada")  return "cursada";
  if (vm.bloqueada)             return "bloqueada";
  if (vm.puedeCursar)           return "disponible";
  return "disponible";
}

export function getStateLabel(ve: VisualEstado) {
  if (ve === "aprobada")  return "aprobada";
  if (ve === "cursada")   return "cursando";
  if (ve === "disponible") return "disponible";
  return "bloqueada";
}

// ── Node data types ───────────────────────────────────────────────────────────
export type NodeData = {
  label: string;
  horas: string;
  visualEstado: VisualEstado;
  highlighted: boolean;
  dimmed: boolean;
  hasAviso: boolean;
};

export type AgrupadorNodeData = { nombre: string; cantidad: number; dimmed: boolean };

export function tieneAviso(m: { grupo_opcion?: unknown; nombre: string }): boolean {
  return Boolean(m.grupo_opcion) || m.nombre.toLowerCase().includes("tesis");
}

// ── Layout types ──────────────────────────────────────────────────────────────
export type LayoutMode = "cuatrimestre" | "topologico";

// ── Edge styles ───────────────────────────────────────────────────────────────
const EDGE_COLOR = {
  aprobada:  { stroke: STATUS_COLORS.aprobada.accent,  strokeWidth: 1.5, opacity: 1   },
  cursada:   { stroke: STATUS_COLORS.cursada.accent,   strokeWidth: 1.5, opacity: 1   },
  bloqueada: { stroke: "rgba(255,255,255,0.25)",        strokeWidth: 1,   opacity: 0.6 },
  default:   { stroke: "rgba(157,78,221,0.85)",         strokeWidth: 1.5, opacity: 1   },
} as const;

const TRANSITIVE_EDGE_STYLE = {
  stroke: "rgba(251,146,60,0.70)", strokeWidth: 1, opacity: 1,
} as const;

const REDUCED_EDGE_STYLE = {
  stroke: "rgba(239,68,68,0.9)", strokeWidth: 1.6, opacity: 1,
} as const;

export function getEdgeStyle(
  sourceVe: VisualEstado | undefined,
  targetVe: VisualEstado,
): CSSProperties {
  if (targetVe === "bloqueada") return EDGE_COLOR.bloqueada;
  if (sourceVe === "aprobada")  return EDGE_COLOR.aprobada;
  if (sourceVe === "cursada")   return EDGE_COLOR.cursada;
  return EDGE_COLOR.default;
}

// ── Graph traversal ───────────────────────────────────────────────────────────
// Both functions expect a pre-built adjacency map to avoid O(E) edge scans
// inside the BFS loop. Build it once per edge array with buildAdjacency().
export function buildAdjacency(edges: Edge[]): {
  adjIn:  Map<string, string[]>;
  adjOut: Map<string, string[]>;
} {
  const adjIn  = new Map<string, string[]>();
  const adjOut = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjIn.has(e.target))  adjIn.set(e.target, []);
    if (!adjOut.has(e.source)) adjOut.set(e.source, []);
    adjIn.get(e.target)!.push(e.source);
    adjOut.get(e.source)!.push(e.target);
  }
  return { adjIn, adjOut };
}

export function getAncestors(nodeId: string, adjIn: Map<string, string[]>): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const src of adjIn.get(cur) ?? []) {
      if (!result.has(src)) { result.add(src); queue.push(src); }
    }
  }
  return result;
}

export function getDescendants(nodeId: string, adjOut: Map<string, string[]>): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const tgt of adjOut.get(cur) ?? []) {
      if (!result.has(tgt)) { result.add(tgt); queue.push(tgt); }
    }
  }
  return result;
}

// ── Topological layout ────────────────────────────────────────────────────────
// Kahn's algorithm — O(V+E). Assigns each node its longest-path level (critical
// path). Only direct edges between nodes in `ids` are considered.
export function calcularNivelTopologico(
  ids: string[],
  edges: Edge[],
): Map<string, number> {
  const idSet = new Set(ids);

  const adjOut = new Map<string, string[]>(ids.map((id) => [id, []]));
  const inDeg  = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    if (e.data?.isTransitive) continue;
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    adjOut.get(e.source)!.push(e.target);
    inDeg.set(e.target, inDeg.get(e.target)! + 1);
  }

  const nivel = new Map<string, number>();
  const cola: string[] = ids.filter((id) => inDeg.get(id) === 0);
  for (const id of cola) nivel.set(id, 0);
  let head = 0;

  while (head < cola.length) {
    const cur = cola[head++];
    const lvl = nivel.get(cur)!;
    for (const nxt of adjOut.get(cur)!) {
      const newLvl = lvl + 1;
      if (newLvl > (nivel.get(nxt) ?? 0)) nivel.set(nxt, newLvl);
      const remaining = inDeg.get(nxt)! - 1;
      inDeg.set(nxt, remaining);
      if (remaining === 0) cola.push(nxt);
    }
  }

  for (const id of ids) {
    if (!nivel.has(id)) nivel.set(id, 0);
  }
  return nivel;
}

export function posicionarTopologico(
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
      posMap.set(id, { x: offsetX + i * COL_W, y: lvl * ROW_H });
    });
  }
  return posMap;
}

// ── Transitive reduction ──────────────────────────────────────────────────────
// True transitive reduction of the direct-edge DAG (Hasse diagram).
//
// Algorithm: precompute the full reachability set for every node in O(V*(V+E))
// using DFS in reverse topological order. Then for each edge (u→v), it is
// redundant iff any *other* neighbor w of u can reach v — O(1) lookup.
// Total: O(V*(V+E) + E), vs the naive O(E*(V+E)) with a BFS per edge.
//
// Artificial transitive edges (isTransitive:true) are always dropped.
export function transitiveReduction(allEdges: Edge[]): Edge[] {
  const directEdges = allEdges.filter((e) => !e.data?.isTransitive);

  // Build adjacency list and collect all node ids.
  const adjOut = new Map<string, string[]>();
  const nodes  = new Set<string>();
  for (const e of directEdges) {
    if (!adjOut.has(e.source)) adjOut.set(e.source, []);
    adjOut.get(e.source)!.push(e.target);
    nodes.add(e.source);
    nodes.add(e.target);
  }

  // Topological order via Kahn (reuse inDeg pattern already in this file).
  const inDeg = new Map<string, number>();
  for (const id of nodes) inDeg.set(id, 0);
  for (const e of directEdges) inDeg.set(e.target, inDeg.get(e.target)! + 1);
  const topoOrder: string[] = [];
  const queue = Array.from(nodes).filter((id) => inDeg.get(id) === 0);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    topoOrder.push(cur);
    for (const nxt of adjOut.get(cur) ?? []) {
      const d = inDeg.get(nxt)! - 1;
      inDeg.set(nxt, d);
      if (d === 0) queue.push(nxt);
    }
  }

  // Reachability sets computed in reverse topological order (leaves first).
  // reach[u] = set of all nodes reachable from u via ≥1 edge.
  const reach = new Map<string, Set<string>>();
  for (const id of nodes) reach.set(id, new Set());

  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const u = topoOrder[i];
    const ru = reach.get(u)!;
    for (const v of adjOut.get(u) ?? []) {
      ru.add(v);
      for (const w of reach.get(v)!) ru.add(w);
    }
  }

  // An edge (u→v) is redundant iff u can reach v through another neighbor.
  const redundant = new Set<string>();
  for (const e of directEdges) {
    const { source: u, target: v } = e;
    for (const w of adjOut.get(u) ?? []) {
      if (w !== v && reach.get(w)!.has(v)) {
        redundant.add(e.id);
        break;
      }
    }
  }

  return directEdges
    .filter((e) => !redundant.has(e.id))
    .map((e) => ({ ...e, style: { ...e.style, ...REDUCED_EDGE_STYLE } }));
}

// ── Build graph ───────────────────────────────────────────────────────────────
export function hasHorasData(materiaById: Map<string, Materia>): boolean {
  for (const [, m] of materiaById) {
    if ((parseFloat(m.horas ?? "") || 0) > 0) return true;
  }
  return false;
}

export function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>,
  selectedOrientacion: string,
  layoutMode: LayoutMode,
): {
  nodes: Node[];
  edges: Edge[];
  materiaById: Map<string, Materia>;
  vmById: Map<string, VisualEstado>;
} {
  const materiaById = new Map(materias.map((m) => [String(m.id), m]));

  const normales = materias.filter(
    (m) =>
      !idsAgrupadores.has(String(m.id)) &&
      !m.grupo_opcion &&
      m.año &&
      m.cuatrimestre &&
      passesOrientationFilter(m, selectedOrientacion, idsAgrupadores, agrupadores),
  );

  type AgrupadorConUbicacion = Agrupador & { año: string; cuatrimestre: string };
  const agrupadorItems: AgrupadorConUbicacion[] = agrupadores
    .map((a) => {
      const agAsMat = { id: a.id } as Materia;
      if (!passesOrientationFilter(agAsMat, selectedOrientacion, idsAgrupadores, agrupadores))
        return null;
      const primera = a.opciones
        .map((id) => materiaById.get(String(id)))
        .find((m) => m?.año && m.cuatrimestre);
      if (!primera) return null;
      return { ...a, año: primera.año!, cuatrimestre: primera.cuatrimestre! };
    })
    .filter((a): a is AgrupadorConUbicacion => a !== null);

  const extractNum = (s: string) => {
    const m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  const allPairs = [
    ...normales.map((m) => ({ año: m.año!, cuatrimestre: m.cuatrimestre! })),
    ...agrupadorItems.map((a) => ({ año: a.año, cuatrimestre: a.cuatrimestre })),
  ];
  const uniquePairs = Array.from(
    new Map(allPairs.map((p) => [`${p.año}|${p.cuatrimestre}`, p])).values(),
  ).sort((a, b) => {
    const d = extractNum(a.año) - extractNum(b.año);
    return d !== 0 ? d : extractNum(a.cuatrimestre) - extractNum(b.cuatrimestre);
  });

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

  const visibleIds = new Set([
    ...normales.map((m) => String(m.id)),
    ...agrupadorItems.map((a) => String(a.id)),
  ]);

  // Direct edges
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
      edges.push({
        id: edgeId,
        source: reqId,
        target: targetId,
        type: "smoothstep",
        style: getEdgeStyle(vmById.get(reqId), targetVe),
        animated: false,
      });
    }
  }

  // Transitive (decorative) edges: A→C where the direct path is A→…→C
  const directEdgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
  const adjOut = new Map<string, string[]>();
  for (const id of visibleIds) adjOut.set(id, []);
  for (const e of edges) adjOut.get(e.source)?.push(e.target);

  const findPath = (from: string, to: string): string[] => {
    const parentMap = new Map<string, string>();
    const bfsVisited = new Set<string>([from]);
    const bfsQueue = [from];
    while (bfsQueue.length > 0) {
      const cur = bfsQueue.shift()!;
      for (const next of adjOut.get(cur) ?? []) {
        if (bfsVisited.has(next)) continue;
        bfsVisited.add(next);
        parentMap.set(next, cur);
        if (next === to) {
          const path: string[] = [];
          let node: string | undefined = to;
          while (node !== undefined) { path.unshift(node); node = parentMap.get(node); }
          return path;
        }
        bfsQueue.push(next);
      }
    }
    return [from, to];
  };

  for (const startId of visibleIds) {
    const directNeighbors = new Set(adjOut.get(startId) ?? []);
    const visited = new Set<string>([startId]);
    const queue: string[] = Array.from(directNeighbors);
    for (const dn of directNeighbors) visited.add(dn);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of adjOut.get(cur) ?? []) {
        if (
          !directNeighbors.has(next) &&
          !directEdgeSet.has(`${startId}->${next}`) &&
          next !== startId
        ) {
          const edgeId = `transitive:${startId}->${next}`;
          if (!directEdgeSet.has(edgeId)) {
            directEdgeSet.add(edgeId);
            const pathIds = findPath(startId, next);
            const pathLabel = pathIds
              .map((id) => materiaById.get(id)?.nombre ?? id)
              .join(" → ");
            edges.push({
              id: edgeId,
              source: startId,
              target: next,
              type: "transitive",
              style: { ...TRANSITIVE_EDGE_STYLE, strokeDasharray: "4 3" },
              animated: false,
              data: { isTransitive: true, path: pathLabel },
            });
          }
        }
        if (!visited.has(next)) { visited.add(next); queue.push(next); }
      }
    }
  }

  // Node positions
  const topoIds = normales.map((m) => String(m.id));
  const topoPosMap =
    layoutMode === "topologico" ? posicionarTopologico(topoIds, edges) : null;

  const posMap = (id: string) =>
    layoutMode === "topologico"
      ? (topoPosMap!.get(id) ?? cuatPosMap.get(id) ?? { x: 0, y: 0 })
      : (cuatPosMap.get(id) ?? { x: 0, y: 0 });

  const nodes: Node[] = [
    ...normales.map((m) => {
      const hasAviso = tieneAviso(m);
      return {
        id: String(m.id),
        type: "materia",
        position: posMap(String(m.id)),
        data: {
          label: m.nombre,
          horas: m.horas ?? "?",
          visualEstado: vmById.get(String(m.id)) ?? "bloqueada",
          highlighted: false,
          dimmed: false,
          hasAviso,
        } satisfies NodeData,
      };
    }),
    ...agrupadorItems.map((a) => ({
      id: String(a.id),
      type: "agrupador",
      position: cuatPosMap.get(String(a.id)) ?? { x: 0, y: 0 },
      data: {
        nombre: a.nombre,
        cantidad: a.opciones.length,
        dimmed: false,
      } satisfies AgrupadorNodeData,
    })),
  ];

  return { nodes, edges, materiaById, vmById };
}
