"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, ControlButton, Panel,
  useNodesState, useEdgesState, useReactFlow,
  BackgroundVariant, type Node, type Edge,
} from "@xyflow/react";
import type { Agrupador, Materia } from "@/app/types/plan";
import type { EstadoMateria } from "@/lib/plan/evaluarCorrelativas";
import { GLASS, TEXT, TEXT_SEC, ACCENT } from "@/lib/ui/tokens";
import {
  STATE_STYLE, AMBER, getStateLabel, buildAdjacency, getAncestors, getDescendants,
  NODE_W, NODE_H, GAP_X, GAP_Y,
  type VisualEstado, type NodeData,
} from "../graphUtils";
import { nodeTypes, edgeTypes } from "../nodeTypes";
import { DetailPanel } from "./DetailPanel";

export type MiVistaData = {
  nodeIds: string[];
  positions: Record<string, { x: number; y: number }>;
};

export function loadMiVista(key: string): MiVistaData | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MiVistaData) : null;
  } catch { return null; }
}

export function saveMiVista(key: string, data: MiVistaData) {
  localStorage.setItem(key, JSON.stringify(data));
}

type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  reglamentoUrl?: string | null;
  onVerEnPlan?: (id: string) => void;
  allBaseEdges: Edge[];
  vmById: Map<string, VisualEstado>;
  storageKey: string;
  initialData: MiVistaData | null;
  onGuardar: (data: MiVistaData) => void;
  onCerrar: () => void;
};

export function EditorPanel({
  materias, agrupadores, idsAgrupadores, estados, reglamentoUrl, onVerEnPlan,
  allBaseEdges, vmById, storageKey, initialData, onGuardar, onCerrar,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set(initialData?.nodeIds ?? []));
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    () => initialData?.positions ?? {},
  );
  const { fitView: edFitView } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const materiaById = useMemo(
    () => new Map(materias.map((m) => [String(m.id), m])),
    [materias],
  );

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return materias
      .filter((m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion)
      .filter((m) => m.nombre.toLowerCase().includes(q))
      .filter((m) => !addedIds.has(String(m.id)))
      .slice(0, 8);
  }, [busqueda, materias, idsAgrupadores, addedIds]);

  const agregarMateria = useCallback((m: Materia) => {
    const id = String(m.id);
    const idx = addedIds.size;
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const newPos = { x: col * (NODE_W + GAP_X + 20), y: row * (NODE_H + GAP_Y + 20) };
    const ve = vmById.get(id) ?? "bloqueada";
    const hasAviso = Boolean(m.grupo_opcion) || m.nombre.toLowerCase().includes("tesis");
    const newNode: Node = {
      id, type: "materia",
      position: newPos,
      data: { label: m.nombre, horas: m.horas ?? "?", visualEstado: ve, highlighted: false, dimmed: false, hasAviso } satisfies NodeData,
      selected: false,
    };
    setPositions((prev) => ({ ...prev, [id]: newPos }));
    setEdNodes((current) => [...current, newNode]);
    setAddedIds((prev) => new Set([...prev, id]));
    setBusqueda("");
    if (idx === 0) setTimeout(() => edFitView({ padding: 0.3, duration: 300 }), 50);
  }, [addedIds, vmById, edFitView]);

  const quitarMateria = useCallback((id: string) => {
    setAddedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setPositions((prev) => { const p = { ...prev }; delete p[id]; return p; });
    if (selectedNodeId === id) setSelectedNodeId(null);
  }, [selectedNodeId]);

  const editorNodes = useMemo<Node[]>(() => {
    return Array.from(addedIds).map((id) => {
      const m = materiaById.get(id);
      const ve = vmById.get(id) ?? "bloqueada";
      const hasAviso = Boolean(m?.grupo_opcion) || Boolean(m?.nombre.toLowerCase().includes("tesis"));
      return {
        id, type: "materia",
        position: positions[id] ?? { x: 0, y: 0 },
        data: { label: m?.nombre ?? id, horas: m?.horas ?? "?", visualEstado: ve, highlighted: false, dimmed: false, hasAviso } satisfies NodeData,
        selected: id === selectedNodeId,
      };
    });
  }, [addedIds, positions, materiaById, vmById, selectedNodeId]);

  const editorEdges = useMemo<Edge[]>(
    () => allBaseEdges.filter((e) => addedIds.has(e.source) && addedIds.has(e.target)),
    [allBaseEdges, addedIds],
  );

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredDebounced = useCallback((id: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (id === null) setHoveredNodeId(null);
    else hoverTimerRef.current = setTimeout(() => setHoveredNodeId(id), 30);
  }, []);

  const { adjIn: edAdjIn, adjOut: edAdjOut } = useMemo(
    () => buildAdjacency(editorEdges),
    [editorEdges],
  );

  const activeChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId) return null;
    const chain = new Set<string>([hoveredNodeId]);
    for (const id of getAncestors(hoveredNodeId, edAdjIn)) chain.add(id);
    for (const id of getDescendants(hoveredNodeId, edAdjOut)) chain.add(id);
    return chain;
  }, [hoveredNodeId, edAdjIn, edAdjOut]);

  const [edNodes, setEdNodes, onEdNodesChange] = useNodesState(editorNodes);
  const [edEdges, setEdEdges, onEdEdgesChange] = useEdgesState(editorEdges);

  const prevAddedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prev = prevAddedIdsRef.current;
    const removedIds = Array.from(prev).filter((id) => !addedIds.has(id));
    prevAddedIdsRef.current = new Set(addedIds);
    if (removedIds.length > 0) {
      setEdNodes((current) => current.filter((n) => addedIds.has(n.id)));
    }
  }, [addedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setEdEdges(editorEdges); }, [editorEdges, setEdEdges]);

  const hoverCss = useMemo(() => {
    if (!hoveredNodeId || !activeChain) return "";
    const dimmed = `.react-flow__node:not([data-id="${Array.from(activeChain).join('"]):not([data-id="')}"]) { opacity: 0.06 !important; transition: opacity 0.12s; }`;
    const active = Array.from(activeChain).map((id) => `.react-flow__node[data-id="${id}"] { opacity: 1 !important; }`).join("");
    const hov = `.react-flow__node[data-id="${hoveredNodeId}"] > div { box-shadow: 0 0 0 3px rgba(200,200,255,0.5) !important; }`;
    return dimmed + active + hov;
  }, [hoveredNodeId, activeChain]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, _node: Node, allNodes: Node[]) => {
    const updated: Record<string, { x: number; y: number }> = {};
    for (const n of allNodes) updated[n.id] = n.position;
    setPositions((prev) => ({ ...prev, ...updated }));
  }, []);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handleGuardar = useCallback(() => {
    const data: MiVistaData = { nodeIds: Array.from(addedIds), positions };
    saveMiVista(storageKey, data);
    onGuardar(data);
  }, [addedIds, positions, storageKey, onGuardar]);

  const selectedMateria = selectedNodeId ? materiaById.get(selectedNodeId) : null;

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: "min(680px, 95vw)",
      background: "rgba(10,14,40,0.97)",
      borderLeft: `1px solid ${GLASS.raised}`,
      backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
      boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${GLASS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Modo edición</div>
          <div style={{ fontSize: 10, color: TEXT_SEC, marginTop: 2 }}>Armá tu propia vista del mapa</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={handleGuardar}
            disabled={addedIds.size === 0}
            style={{
              fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 7,
              background: addedIds.size > 0 ? ACCENT : GLASS.base,
              border: `1px solid ${addedIds.size > 0 ? ACCENT : GLASS.border}`,
              color: addedIds.size > 0 ? "#fff" : TEXT_SEC,
              cursor: addedIds.size > 0 ? "pointer" : "not-allowed",
            }}>
            Guardar vista
          </button>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: TEXT_SEC, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${GLASS.border}`, flexShrink: 0, position: "relative" }}>
        <input
          type="text"
          placeholder="Buscar materia del plan para agregar..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", background: GLASS.elevated, border: `1px solid ${GLASS.strong}`, borderRadius: 7, color: TEXT, fontSize: 12, padding: "7px 12px", outline: "none" }}
        />
        {resultados.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 16, right: 16,
            background: "rgba(15,20,50,0.98)", border: `1px solid ${GLASS.raised}`,
            borderRadius: 8, zIndex: 10, overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {resultados.map((m) => {
              const ve = vmById.get(String(m.id)) ?? "bloqueada";
              const s = STATE_STYLE[ve];
              return (
                <div
                  key={m.id}
                  onClick={() => agregarMateria(m)}
                  style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${GLASS.border}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = GLASS.elevated)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.text, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: TEXT, flex: 1 }}>{m.nombre}</span>
                  <span style={{ fontSize: 9, color: s.text, background: `${s.bg}99`, border: `1px solid ${s.border}`, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>
                    {getStateLabel(ve)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {addedIds.size > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Array.from(addedIds).map((id) => {
              const m = materiaById.get(id);
              const ve = vmById.get(id) ?? "bloqueada";
              return (
                <span key={id} style={{
                  fontSize: 10, padding: "2px 7px 2px 8px", borderRadius: 5,
                  background: `${STATE_STYLE[ve].bg}99`, border: `1px solid ${STATE_STYLE[ve].border}`,
                  color: STATE_STYLE[ve].text, display: "flex", alignItems: "center", gap: 4,
                }}>
                  {m?.nombre ?? id}
                  <button onClick={() => quitarMateria(id)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1, opacity: 0.7 }}>×</button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {addedIds.size === 0 ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: TEXT_SEC }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>◻</div>
            <div style={{ fontSize: 12 }}>Buscá una materia para empezar</div>
          </div>
        ) : (
          <ReactFlow
            nodes={edNodes} edges={edEdges}
            onNodesChange={onEdNodesChange}
            onEdgesChange={onEdEdgesChange}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodeDragStop={handleNodeDragStop}
            onNodeClick={handleNodeClick}
            onPaneClick={() => setSelectedNodeId(null)}
            onNodeMouseEnter={(_, node) => setHoveredDebounced(node.id)}
            onNodeMouseLeave={() => setHoveredDebounced(null)}
            nodesDraggable
            defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
            minZoom={0.3} maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            {hoverCss && <style>{hoverCss}</style>}
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
            <Controls style={{ background: GLASS.base, border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}>
              <ControlButton onClick={() => edFitView({ padding: 0.2, duration: 400 })} title="Ajustar vista" style={{ fontSize: 11, fontWeight: 700, color: TEXT_SEC }}>F</ControlButton>
            </Controls>
            {selectedMateria && selectedNodeId && (
              <Panel position="top-left">
                <DetailPanel
                  nodeId={selectedNodeId} materias={materias}
                  idsAgrupadores={idsAgrupadores} vmById={vmById}
                  reglamentoUrl={reglamentoUrl}
                  onClose={() => setSelectedNodeId(null)} onVerEnPlan={onVerEnPlan}
                />
              </Panel>
            )}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
