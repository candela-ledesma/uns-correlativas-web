import type { Node, Edge } from "@xyflow/react";
import type { Materia } from "@/app/types/plan";
import type { VisualEstado } from "./graphUtils";

export type OptMode = "materias" | "cuatrimestres" | "horas";

export type BestPathResult = {
  camino: string[];
  pendientes: string[];
  destino: string;
  totalPendientes: number;
  cuatrimestresEstimados: number;
};

export function calcularMejorCamino(
  nodes: Node[],
  edges: Edge[],
  vmById: Map<string, VisualEstado>,
  materiaById: Map<string, Materia>,
  mode: OptMode,
): BestPathResult | null {
  if (nodes.length === 0) return null;

  const sucesores:   Record<string, string[]> = {};
  const predecesores: Record<string, string[]> = {};
  for (const n of nodes) { sucesores[n.id] = []; predecesores[n.id] = []; }
  for (const e of edges) {
    sucesores[e.source]?.push(e.target);
    predecesores[e.target]?.push(e.source);
  }

  const nodosHoja = nodes.filter((n) => sucesores[n.id].length === 0);
  if (nodosHoja.length === 0) return null;

  const contarAntecesores = (id: string): number => {
    const visited = new Set<string>();
    const q = [id];
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const p of predecesores[cur] ?? []) {
        if (!visited.has(p)) { visited.add(p); q.push(p); }
      }
    }
    return visited.size;
  };

  const scoreLeaf = (leafId: string, ancestorSet: Set<string>): number => {
    const all = [leafId, ...Array.from(ancestorSet)];
    const pending = all.filter((id) => vmById.get(id) !== "aprobada");
    if (mode === "horas") {
      return pending.reduce(
        (acc, id) => acc + (parseFloat(materiaById.get(id)?.horas ?? "0") || 0),
        0,
      );
    }
    if (mode === "cuatrimestres") {
      const pendSet = new Set(pending);
      const inDeg2 = new Map<string, number>(pending.map((id) => [id, 0]));
      // Build adjOut scoped to pending nodes — O(E) once, not O(E) per level.
      const adjOut2 = new Map<string, string[]>(pending.map((id) => [id, []]));
      for (const e of edges) {
        if (pendSet.has(e.source) && pendSet.has(e.target)) {
          inDeg2.set(e.target, inDeg2.get(e.target)! + 1);
          adjOut2.get(e.source)!.push(e.target);
        }
      }
      let lvl = 0;
      let cur2 = pending.filter((id) => inDeg2.get(id) === 0);
      while (cur2.length > 0) {
        lvl++;
        const nxt: string[] = [];
        for (const c of cur2) {
          for (const t of adjOut2.get(c) ?? []) {
            const d = inDeg2.get(t)! - 1;
            inDeg2.set(t, d);
            if (d === 0) nxt.push(t);
          }
        }
        cur2 = nxt;
      }
      return lvl;
    }
    return pending.length;
  };

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
        for (const p of predecesores[cur] ?? []) {
          if (!anc.has(p)) { anc.add(p); q.push(p); }
        }
      }
      const s = scoreLeaf(n.id, anc);
      if (s < bestScore) { bestScore = s; destino = n; }
    }
  }

  const todosAntecesores = new Set<string>();
  const bfsQ = [destino.id];
  while (bfsQ.length > 0) {
    const cur = bfsQ.shift()!;
    for (const p of predecesores[cur] ?? []) {
      if (!todosAntecesores.has(p)) { todosAntecesores.add(p); bfsQ.push(p); }
    }
  }
  todosAntecesores.add(destino.id);

  const subNodos = Array.from(todosAntecesores);
  const inDeg = new Map<string, number>();
  for (const id of subNodos) {
    inDeg.set(
      id,
      (predecesores[id] ?? []).filter((p) => todosAntecesores.has(p)).length,
    );
  }
  const cola: string[] = subNodos.filter((id) => inDeg.get(id) === 0);
  const ordenTopologico: string[] = [];
  let head = 0;
  while (head < cola.length) {
    const cur = cola[head++];
    ordenTopologico.push(cur);
    for (const s of sucesores[cur] ?? []) {
      if (!todosAntecesores.has(s)) continue;
      const d = (inDeg.get(s) ?? 0) - 1;
      inDeg.set(s, d);
      if (d === 0) cola.push(s);
    }
  }

  const nivel: Record<string, number> = {};
  for (const id of ordenTopologico) {
    const predsEnSub = (predecesores[id] ?? []).filter((p) => todosAntecesores.has(p));
    let max = 0;
    for (const p of predsEnSub) if ((nivel[p] ?? 0) > max) max = nivel[p] ?? 0;
    nivel[id] = predsEnSub.length === 0 ? 0 : max + 1;
  }
  let maxNivel = 0;
  for (const id of ordenTopologico) if ((nivel[id] ?? 0) > maxNivel) maxNivel = nivel[id] ?? 0;

  const pendientes = ordenTopologico.filter((id) => vmById.get(id) !== "aprobada");

  return {
    camino: ordenTopologico,
    pendientes,
    destino: destino.id,
    totalPendientes: pendientes.length,
    cuatrimestresEstimados: maxNivel + 1,
  };
}
