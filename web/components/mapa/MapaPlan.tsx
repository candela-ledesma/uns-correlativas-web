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
  buildGraph, hasHorasData, buildAdjacency, getAncestors, getDescendants,
  transitiveReduction, STATE_STYLE, AMBER,
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
function HoverStyleInjector({
  hoveredNodeId, activeChain, setEdges, baseEdges, caminoActivo,
}: {
  hoveredNodeId: string | null;
  activeChain: Set<string> | null;
  setEdges: (edges: Edge[]) => void;
  baseEdges: Edge[];
  caminoActivo: boolean;
}) {
  const css = useMemo(() => {
    if (caminoActivo || !hoveredNodeId || !activeChain) return "";
    const dimmed = `.react-flow__node:not([data-id="${Array.from(activeChain).join('"]):not([data-id="')}"]) { opacity: 0.06 !important; transition: opacity 0.12s; }`;
    const active = Array.from(activeChain).map((id) => `.react-flow__node[data-id="${id}"] { opacity: 1 !important; transition: opacity 0.12s; }`).join("");
    const hovered = `.react-flow__node[data-id="${hoveredNodeId}"] > div { box-shadow: 0 0 0 3px rgba(200,200,255,0.5) !important; }`;
    return dimmed + active + hovered;
  }, [hoveredNodeId, activeChain, caminoActivo]);

  useEffect(() => {
    if (caminoActivo || !hoveredNodeId || !activeChain) return;
    setEdges(baseEdges.map((e) => {
      const inChain = activeChain.has(e.source) && activeChain.has(e.target);
      return {
        ...e,
        style: inChain
          ? { stroke: "rgba(157,78,221,0.9)", strokeWidth: 2, opacity: 1 }
          : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 },
      };
    }));
  }, [hoveredNodeId, activeChain, caminoActivo, baseEdges, setEdges]);

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

  const hasHoras = useMemo(() => hasHorasData(materiaById), [materiaById]);

  const [filtro, setFiltro]               = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda]           = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelSide, setPanelSide]         = useState<"left" | "right">("right");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [caminoActivo, setCaminoActivo]   = useState(false);
  const [optMode, setOptMode]             = useState<OptMode>("materias");
  const [simplificarGrafo, setSimplificarGrafo] = useState(false);
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

  const activeChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId || caminoActivo) return null;
    const chain = new Set<string>([hoveredNodeId]);
    for (const id of getAncestors(hoveredNodeId, adjIn)) chain.add(id);
    for (const id of getDescendants(hoveredNodeId, baseAdjOut)) chain.add(id);
    return chain;
  }, [hoveredNodeId, adjIn, baseAdjOut, caminoActivo]);

  const displayNodes = useMemo<Node[]>(() => {
    return baseNodes.map((n) => {
      const custom = customPositions.get(n.id);
      const position = custom ?? n.position;
      if (n.type === "agrupador") {
        return { ...n, position, draggable: true, data: { ...n.data, dimmed: filtro !== "todas" } };
      }
      const ve = vmById.get(n.id) ?? "bloqueada";
      const dimmed = filtro !== "todas" && ve !== filtro && !caminoActivo;
      return {
        ...n, position,
        data: { ...n.data, dimmed, highlighted: n.id === highlightedId },
        selected: n.id === selectedNodeId,
      };
    });
  }, [baseNodes, filtro, highlightedId, selectedNodeId, vmById, caminoActivo, customPositions]);

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
    return simplificarGrafo ? transitiveReduction(raw) : raw;
  }, [miVistaActiva, miVistaEdges, baseEdges, simplificarGrafo]);

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
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

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
        simplificarGrafo={simplificarGrafo} onToggleSimplificar={() => setSimplificarGrafo((v) => !v)}
      />

      <div style={{
        width: "100%", height: "72vh", minHeight: 480, borderRadius: 14,
        overflow: "hidden", position: "relative",
        border: `1px solid ${caminoActivo ? AMBER.border : GLASS.raised}`,
        background: "rgba(15,20,50,0.55)", transition: "border-color 0.2s",
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
          onPaneClick={() => setSelectedNodeId(null)}
          onNodeDragStop={handleNodeDragStop}
          nodesDraggable selectionOnDrag multiSelectionKeyCode="Shift"
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.35} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          onInit={handleInit}
        >
          <HoverStyleInjector
            hoveredNodeId={hoveredNodeId} activeChain={activeChain}
            setEdges={setEdges} baseEdges={visibleEdges} caminoActivo={caminoActivo}
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
