"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { GLASS, TEXT_SEC, ACCENT } from "@/lib/ui/tokens";
import { extractOrientaciones } from "@/lib/plan/kanbanUtils";

import {
  buildGraph, hasHorasData, buildAdjacency, getAncestors, getDescendants, getAncestorsWithDistance,
  STATE_STYLE, AMBER,
  type VisualEstado, type NodeData, type LayoutMode,
} from "@/lib/mapa/graphUtils";
import { calcularMejorCamino, type OptMode, type BestPathResult } from "@/lib/mapa/bestPath";
import { nodeTypes, edgeTypes } from "./nodeTypes";
import { Toolbar, type FiltroEstado } from "./Toolbar";
import { DetailPanel } from "./panels/DetailPanel";
import { BestPathPanel } from "./panels/BestPathPanel";
import {
  EditorPanel, loadMiVista, type MiVistaData,
} from "./panels/EditorPanel";

// ── Props ────────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  carreraId: string;
  reglamentoUrl?: string | null;
  onVerEnPlan?: (materiaId: string) => void;
};

// ── HoverStyleInjector ────────────────────────────────────────────────────────
// focusNodeId comes from either a transient hover or a pinned "Ver camino"
// selection (MapaPlan resolves which one wins before passing it down).
function HoverStyleInjector({
  focusNodeId, activeChain, setEdges, baseEdges, caminoActivo,
}: {
  focusNodeId: string | null;
  activeChain: Set<string> | null;
  setEdges: (edges: Edge[]) => void;
  baseEdges: Edge[];
  caminoActivo: boolean;
}) {
  const css = useMemo(() => {
    if (caminoActivo || !focusNodeId || !activeChain) return "";
    const dimmed = `.react-flow__node:not([data-id="${Array.from(activeChain).join('"]):not([data-id="')}"]) { opacity: 0.06 !important; transition: opacity 0.12s; }`;
    const active = Array.from(activeChain).map((id) => `.react-flow__node[data-id="${id}"] { opacity: 1 !important; transition: opacity 0.12s; }`).join("");
    const hovered = `.react-flow__node[data-id="${focusNodeId}"] > div { box-shadow: 0 0 0 3px rgba(200,200,255,0.5) !important; }`;
    return dimmed + active + hovered;
  }, [focusNodeId, activeChain, caminoActivo]);

  useEffect(() => {
    if (caminoActivo || !focusNodeId || !activeChain) return;
    setEdges(baseEdges.map((e) => {
      const inChain = activeChain.has(e.source) && activeChain.has(e.target);
      return {
        ...e,
        style: inChain
          ? { stroke: "rgba(157,78,221,0.9)", strokeWidth: 2, opacity: 1 }
          : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 },
      };
    }));
  }, [focusNodeId, activeChain, caminoActivo, baseEdges, setEdges]);

  if (!css) return null;
  return <style>{css}</style>;
}

// ── CaminoIndirectoInjector ──────────────────────────────────────────────────
// Highlights the ancestor chain of a pinned node ("Ver camino") leg by leg:
// each real correlativa edge that lands on the focal node is violet (direct),
// every other real edge further back in the chain is amber (indirect — only
// reachable through an intermediate). Decorative isTransitive shortcut edges
// (the global "Caminos indirectos" toggle) are excluded entirely here — they'd
// duplicate the same information as a single A→Z line overlapping the real
// per-leg path. Keyed by e.data.isTransitive, not "target === focus": a
// decorative edge can also point straight at the focal node and would
// otherwise be misclassified as the direct correlativa.
function CaminoIndirectoInjector({
  focusNodeId, chainSet, setEdges, baseEdges,
}: {
  focusNodeId: string | null;
  chainSet: Set<string> | null;
  setEdges: (edges: Edge[]) => void;
  baseEdges: Edge[];
}) {
  const css = useMemo(() => {
    if (!focusNodeId || !chainSet) return "";
    const all = [focusNodeId, ...Array.from(chainSet)];
    const dimmed = `.react-flow__node:not([data-id="${all.join('"]):not([data-id="')}"]) { opacity: 0.06 !important; transition: opacity 0.12s; }`;
    const active = all.map((id) => `.react-flow__node[data-id="${id}"] { opacity: 1 !important; transition: opacity 0.12s; }`).join("");
    const focal = `.react-flow__node[data-id="${focusNodeId}"] > div { box-shadow: 0 0 0 3px ${AMBER.border} !important; }`;
    return dimmed + active + focal;
  }, [focusNodeId, chainSet]);

  useEffect(() => {
    if (!focusNodeId || !chainSet) return;
    setEdges(baseEdges.map((e) => {
      if (e.data?.isTransitive) {
        return { ...e, style: { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 } };
      }
      const targetInChain = e.target === focusNodeId || chainSet.has(e.target);
      const sourceInChain = e.source === focusNodeId || chainSet.has(e.source);
      if (!sourceInChain || !targetInChain) {
        return { ...e, style: { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 } };
      }
      const isDirectToFocus = e.target === focusNodeId;
      return {
        ...e,
        style: isDirectToFocus
          ? { stroke: "rgba(157,78,221,0.9)", strokeWidth: 2, opacity: 1 }
          : { stroke: AMBER.border, strokeWidth: 2, opacity: 1 },
      };
    }));
  }, [focusNodeId, chainSet, baseEdges, setEdges]);

  if (!css) return null;
  return <style>{css}</style>;
}

// ── CaminoStyleInjector ───────────────────────────────────────────────────────
function CaminoStyleInjector({
  caminoSet, vmById, setEdges, baseEdges,
}: {
  caminoSet: Set<string> | null;
  vmById: Map<string, VisualEstado>;
  setEdges: (edges: Edge[]) => void;
  baseEdges: Edge[];
}) {
  const css = useMemo(() => {
    if (!caminoSet) return "";
    const inCamino = Array.from(caminoSet);
    const notInCamino = `.react-flow__node:not([data-id="${inCamino.join('"]):not([data-id="')}"]) { opacity: 0.07 !important; transition: opacity 0.15s; }`;
    const styles = inCamino.map((id) => {
      const ve = vmById.get(id) ?? "bloqueada";
      if (ve === "aprobada") {
        return `.react-flow__node[data-id="${id}"] { opacity: 1 !important; } .react-flow__node[data-id="${id}"] > div { box-shadow: 0 0 0 2px ${AMBER.border}, 0 0 8px rgba(239,159,39,0.25) !important; }`;
      }
      return `.react-flow__node[data-id="${id}"] { opacity: 1 !important; } .react-flow__node[data-id="${id}"] > div { background: rgba(239,159,39,0.12) !important; border-color: ${AMBER.border} !important; box-shadow: 0 0 0 2px ${AMBER.border}, 0 0 8px rgba(239,159,39,0.25) !important; }`;
    }).join("");
    return notInCamino + styles;
  }, [caminoSet, vmById]);

  useEffect(() => {
    if (!caminoSet) return;
    setEdges(baseEdges.map((e) => {
      const inPath = caminoSet.has(e.source) && caminoSet.has(e.target);
      return {
        ...e,
        style: inPath
          ? { stroke: AMBER.border, strokeWidth: 2, opacity: 1 }
          : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 },
      };
    }));
  }, [caminoSet, baseEdges, setEdges]);

  if (!css) return null;
  return <style>{css}</style>;
}

// ── MapaInner ─────────────────────────────────────────────────────────────────
function MapaInner({ materias, agrupadores, idsAgrupadores, estados, carreraId, reglamentoUrl, onVerEnPlan }: Props) {
  const { fitView, getNodes, getNode, flowToScreenPosition } = useReactFlow();

  const [selectedOrientacion, setSelectedOrientacion] = useState("todas");
  const orientaciones = useMemo(() => extractOrientaciones(materias, agrupadores), [materias, agrupadores]);
  const hasOrientaciones = orientaciones.length > 0;

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") return "cuatrimestre";
    return (localStorage.getItem("mapaLayoutMode") as LayoutMode) ?? "cuatrimestre";
  });

  const [customPositions, setCustomPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  const storageKey = `mapaVistaGuardada:${carreraId}`;
  const [miVistaData, setMiVistaData] = useState<MiVistaData | null>(() => {
    if (typeof window === "undefined") return null;
    localStorage.removeItem("mapaVistaGuardada");
    return loadMiVista(storageKey);
  });
  const [miVistaActiva, setMiVistaActiva] = useState(false);
  const [editorAbierto, setEditorAbierto] = useState(false);

  const handleGuardarVista = useCallback((data: MiVistaData) => {
    setMiVistaData(data);
    setEditorAbierto(false);
    setMiVistaActiva(true);
  }, []);

  const { nodes: baseNodes, edges: baseEdges, materiaById, vmById } = useMemo(
    () => buildGraph(materias, agrupadores, idsAgrupadores, estados, selectedOrientacion, layoutMode),
    [materias, agrupadores, idsAgrupadores, estados, selectedOrientacion, layoutMode],
  );

  // Adjacency maps built once per edge array — reused by hover and camino BFS.
  const { adjIn, adjOut: baseAdjOut } = useMemo(
    () => buildAdjacency(baseEdges),
    [baseEdges],
  );

  // Direct-only adjacency (excludes decorative transitive edges) — needed to
  // tell apart a direct correlativa (1 hop) from an indirect one (≥2 hops)
  // for the "Ver camino" highlight.
  const { adjIn: adjInDirect } = useMemo(
    () => buildAdjacency(baseEdges.filter((e) => !e.data?.isTransitive)),
    [baseEdges],
  );

  const hasHoras = useMemo(() => hasHorasData(materiaById), [materiaById]);

  const [filtro, setFiltro]               = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda]           = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelSide, setPanelSide]         = useState<"left" | "right">("right");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId]   = useState<string | null>(null);
  const [caminoActivo, setCaminoActivo]   = useState(false);
  const [optMode, setOptMode]             = useState<OptMode>("materias");
  const [mostrarIndirectas, setMostrarIndirectas] = useState(false);
  const [minimapVisible, setMinimapVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("mapaMinimapVisible");
    return stored === null ? true : stored === "true";
  });

  const isTouchDevice = useRef(
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
  );

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredDebounced = useCallback((id: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (id === null) setHoveredNodeId(null);
    else hoverTimerRef.current = setTimeout(() => setHoveredNodeId(id), 30);
  }, []);

  const bestPath = useMemo<BestPathResult | null>(() => {
    if (!caminoActivo) return null;
    return calcularMejorCamino(baseNodes, baseEdges, vmById, materiaById, optMode);
  }, [caminoActivo, baseNodes, baseEdges, vmById, materiaById, optMode]);

  const caminoSet = useMemo<Set<string> | null>(
    () => (bestPath ? new Set(bestPath.camino) : null),
    [bestPath],
  );

  useEffect(() => {
    if (!caminoSet) return;
    const id = setTimeout(() => {
      const caminoNodes = getNodes().filter((n) => caminoSet.has(n.id));
      if (caminoNodes.length > 0) fitView({ nodes: caminoNodes, padding: 0.3, duration: 450 });
    }, 60);
    return () => clearTimeout(id);
  }, [caminoSet, getNodes, fitView]);

  // Transient hover: highlights ancestors + descendants (both directions).
  // Suppressed while a node is pinned — the pin's own highlight takes over.
  const activeChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || pinnedNodeId || caminoActivo) return null;
    const chain = new Set<string>([hoveredNodeId]);
    for (const id of getAncestors(hoveredNodeId, adjIn)) chain.add(id);
    for (const id of getDescendants(hoveredNodeId, baseAdjOut)) chain.add(id);
    return chain;
  }, [hoveredNodeId, pinnedNodeId, adjIn, baseAdjOut, caminoActivo]);

  // "Ver camino": pinned node from DetailPanel. Ancestors only — "what do I
  // need to get here". dist is longest-path (take-order, see
  // getAncestorsWithDistance) — it answers "which step", not "is this
  // direct". Directness is a separate question, answered by direct-edge
  // membership in adjInDirect, so a direct correlativa that also has a
  // longer indirect path elsewhere doesn't get mislabeled.
  const caminoDistById = useMemo<Map<string, number> | null>(() => {
    if (!pinnedNodeId || caminoActivo) return null;
    return getAncestorsWithDistance(pinnedNodeId, adjInDirect);
  }, [pinnedNodeId, adjInDirect, caminoActivo]);

  const caminoChain = useMemo<Set<string> | null>(
    () => (caminoDistById ? new Set(caminoDistById.keys()) : null),
    [caminoDistById],
  );

  const caminoDirectas = useMemo<Set<string>>(
    () => new Set(pinnedNodeId ? adjInDirect.get(pinnedNodeId) ?? [] : []),
    [pinnedNodeId, adjInDirect],
  );

  // Sorted farthest-first: the order you'd actually take them in, base of the
  // chain first, building up toward the pinned node. paso groups by take-order
  // step (longest-path distance) — derived from correlativa structure, not
  // the curricular año field, so same-año materias at different dependency
  // depths still land in the right step, and no materia shares a step with
  // its own prerequisite (see getAncestorsWithDistance for the diamond case).
  const caminoMaterias = useMemo(() => {
    if (!caminoDistById) return [];
    const maxDist = Math.max(...caminoDistById.values());
    return Array.from(caminoDistById.entries())
      .map(([id, dist]) => ({
        id, dist, paso: maxDist - dist + 1,
        directa: caminoDirectas.has(id),
        nombre: materiaById.get(id)?.nombre ?? id,
        ve: vmById.get(id) ?? ("bloqueada" as VisualEstado),
      }))
      .sort((a, b) => b.dist - a.dist || a.nombre.localeCompare(b.nombre));
  }, [caminoDistById, caminoDirectas, materiaById, vmById]);

  const displayNodes = useMemo<Node[]>(() => {
    return baseNodes.map((n) => {
      const custom = customPositions.get(n.id);
      const position = custom ?? n.position;
      if (n.type === "agrupador") {
        return { ...n, position, draggable: true, data: { ...n.data, dimmed: filtro !== "todas" } };
      }
      const ve = vmById.get(n.id) ?? "bloqueada";
      const dimmed = filtro !== "todas" && ve !== filtro && !caminoActivo;
      const pasoCamino = caminoActivo ? bestPath?.nivelById[n.id] : undefined;
      return {
        ...n, position,
        data: {
          ...n.data, dimmed, highlighted: n.id === highlightedId,
          pasoCamino: pasoCamino !== undefined ? pasoCamino + 1 : undefined,
        },
        selected: n.id === selectedNodeId,
      };
    });
  }, [baseNodes, filtro, highlightedId, selectedNodeId, vmById, caminoActivo, bestPath, customPositions]);

  const miVistaNodes = useMemo<Node[]>(() => {
    if (!miVistaData) return [];
    return miVistaData.nodeIds.map((id) => {
      const m = materiaById.get(id);
      const ve = vmById.get(id) ?? "bloqueada";
      const hasAviso = Boolean(m?.grupo_opcion) || Boolean(m?.nombre.toLowerCase().includes("tesis"));
      return {
        id, type: "materia",
        position: miVistaData.positions[id] ?? { x: 0, y: 0 },
        data: {
          label: m?.nombre ?? id, horas: m?.horas ?? "?", visualEstado: ve,
          highlighted: id === highlightedId,
          dimmed: filtro !== "todas" && ve !== filtro && !caminoActivo,
          hasAviso,
        } satisfies NodeData,
        selected: id === selectedNodeId,
      };
    });
  }, [miVistaData, materiaById, vmById, highlightedId, filtro, caminoActivo, selectedNodeId]);

  const miVistaEdges = useMemo<Edge[]>(() => {
    if (!miVistaData) return [];
    const ids = new Set(miVistaData.nodeIds);
    return baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [miVistaData, baseEdges]);

  const visibleEdges = useMemo<Edge[]>(() => {
    const raw = miVistaActiva ? miVistaEdges : baseEdges;
    return mostrarIndirectas ? raw : raw.filter((e) => !e.data?.isTransitive);
  }, [miVistaActiva, miVistaEdges, baseEdges, mostrarIndirectas]);

  const activeNodes = miVistaActiva ? miVistaNodes : displayNodes;

  const [nodes, setNodes, onNodesChange] = useNodesState(activeNodes);
  const [edges, setEdges] = useEdgesState(visibleEdges);

  useEffect(() => { setNodes(activeNodes); }, [activeNodes, setNodes]);
  useEffect(() => { setEdges(visibleEdges); }, [visibleEdges, setEdges]);

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((v) => {
      const next = !v;
      localStorage.setItem("mapaMinimapVisible", String(next));
      return next;
    });
  }, []);

  const contadores = useMemo<Record<VisualEstado, number>>(() => {
    const c: Record<VisualEstado, number> = { aprobada: 0, cursada: 0, disponible: 0, bloqueada: 0 };
    for (const [, ve] of vmById) c[ve]++;
    return c;
  }, [vmById]);

  const didInitialFit = useRef(false);
  const handleInit = useCallback(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;
    const activeIds = new Set(
      [...vmById.entries()]
        .filter(([, ve]) => ve === "disponible" || ve === "cursada")
        .map(([id]) => id),
    );
    if (activeIds.size > 0)
      fitView({ nodes: getNodes().filter((n) => activeIds.has(n.id)), padding: 0.35, duration: 400 });
    else
      fitView({ padding: 0.15, duration: 400 });
  }, [fitView, getNodes, vmById]);

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
  }, [miVistaActiva]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setPinnedNodeId(null);
        setCaminoActivo(false);
        setEditorAbierto(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitAll]);

  const handleBuscar = useCallback(() => {
    if (!busqueda.trim()) return;
    const q = busqueda.trim().toLowerCase();
    const match = baseNodes.find((n) => {
      if (n.type !== "materia") return false;
      const label = (n.data as NodeData).label.toLowerCase();
      return label.includes(q) || n.id.toLowerCase().includes(q);
    });
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
    setPinnedNodeId(null);
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
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const isMobile = windowWidth < 640;

  return (
    <div style={{ position: "relative" }}>
      {hasOrientaciones && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_SEC, flexShrink: 0 }}>Orientación:</span>
          <select
            value={selectedOrientacion}
            onChange={(e) => {
              setSelectedOrientacion(e.target.value);
              setSelectedNodeId(null);
              setCaminoActivo(false);
            }}
            style={{
              background: selectedOrientacion === "todas" ? GLASS.base : "rgba(157,78,221,0.15)",
              border: selectedOrientacion === "todas" ? `1px solid ${GLASS.raised}` : "1px solid rgba(157,78,221,0.45)",
              borderRadius: 7,
              color: selectedOrientacion === "todas" ? TEXT_SEC : "#c084fc",
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
        miVistaActiva={miVistaActiva} onToggleMiVista={setMiVistaActiva}
        onAbrirEditor={() => setEditorAbierto(true)}
        mostrarIndirectas={mostrarIndirectas} onToggleMostrarIndirectas={() => setMostrarIndirectas((v) => !v)}
      />

      <div style={{
        width: "100%",
        height: isMobile ? "calc(100svh - 220px)" : "72vh",
        minHeight: isMobile ? 380 : 480,
        borderRadius: 14,
        overflow: "hidden", position: "relative",
        border: `1px solid ${caminoActivo ? AMBER.border : GLASS.raised}`,
        background: "rgba(15,20,50,0.55)", transition: "border-color 0.2s",
        touchAction: "none",
      }}>
        {miVistaActiva && miVistaNodes.length === 0 && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8, zIndex: 10,
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: 28, opacity: 0.25 }}>◻</span>
            <span style={{ fontSize: 13, color: TEXT_SEC, opacity: 0.6 }}>
              Agregá materias con el botón <strong>+ Editar</strong>
            </span>
          </div>
        )}
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeClick={handleNodeClick}
          onPaneClick={() => { setSelectedNodeId(null); setPinnedNodeId(null); }}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable selectionOnDrag multiSelectionKeyCode="Shift"
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.35} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          onInit={handleInit}
          panOnScroll={false}
          zoomOnPinch
          panOnDrag
        >
          <HoverStyleInjector
            focusNodeId={hoveredNodeId} activeChain={activeChain}
            setEdges={setEdges} baseEdges={visibleEdges} caminoActivo={caminoActivo}
          />
          <CaminoIndirectoInjector
            focusNodeId={pinnedNodeId} chainSet={caminoChain}
            setEdges={setEdges} baseEdges={visibleEdges}
          />
          <CaminoStyleInjector
            caminoSet={caminoSet} vmById={vmById}
            setEdges={setEdges} baseEdges={visibleEdges}
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />

          <Controls style={{ background: GLASS.base, border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}>
            <ControlButton onClick={fitAll} title="Ajustar vista (F)" style={{ fontSize: 11, fontWeight: 700, color: TEXT_SEC }}>F</ControlButton>
            <ControlButton onClick={toggleMinimap} title={minimapVisible ? "Ocultar minimapa" : "Mostrar minimapa"} style={{ fontSize: 9, fontWeight: 700, color: TEXT_SEC }}>
              {minimapVisible ? "▪" : "▫"}
            </ControlButton>
          </Controls>

          {minimapVisible && !isMobile && (
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

          {selectedMateria && selectedNodeId && !caminoActivo && (
            <Panel position={isMobile ? "bottom-center" : (panelSide === "left" ? "top-left" : "top-right")}>
              <DetailPanel
                nodeId={selectedNodeId} materias={materias}
                idsAgrupadores={idsAgrupadores} vmById={vmById}
                reglamentoUrl={reglamentoUrl}
                onClose={() => { setSelectedNodeId(null); setPinnedNodeId(null); }} onVerEnPlan={onVerEnPlan}
                caminoVisible={pinnedNodeId === selectedNodeId}
                onToggleCamino={() => setPinnedNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId))}
                caminoMaterias={pinnedNodeId === selectedNodeId ? caminoMaterias : []}
              />
            </Panel>
          )}

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

      {editorAbierto && (
        <ReactFlowProvider>
          <EditorPanel
            materias={materias} agrupadores={agrupadores}
            idsAgrupadores={idsAgrupadores} estados={estados}
            reglamentoUrl={reglamentoUrl} onVerEnPlan={onVerEnPlan}
            allBaseEdges={baseEdges} vmById={vmById}
            storageKey={storageKey}
            initialData={miVistaData}
            onGuardar={handleGuardarVista}
            onCerrar={() => setEditorAbierto(false)}
          />
        </ReactFlowProvider>
      )}
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
