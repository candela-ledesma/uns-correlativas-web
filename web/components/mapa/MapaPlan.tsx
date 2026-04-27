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

// ── Props ───────────────────────────────────────────────────────────────────
type Props = {
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  onVerEnPlan?: () => void;
};

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 70;
const GAP_X  = 56;
const GAP_Y  = 20;
const COL_W  = NODE_W + GAP_X;
const ROW_H  = NODE_H + GAP_Y;

// ── State colors (spec) ──────────────────────────────────────────────────────
const STATE_STYLE = {
  aprobada:  { bg: "#3B6D11", text: "#97C459", border: "rgba(151,196,89,0.5)" },
  cursada:   { bg: "#185FA5", text: "#85B7EB", border: "rgba(133,183,235,0.5)" },
  disponible:{ bg: "#534AB7", text: "#AFA9EC", border: "rgba(175,169,236,0.5)" },
  bloqueada: { bg: "rgba(255,255,255,0.04)", text: "#9CA3AF", border: "rgba(255,255,255,0.12)" },
} as const;

type VisualEstado = keyof typeof STATE_STYLE;

// ── Derived visual state ─────────────────────────────────────────────────────
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

// ── Node data types ──────────────────────────────────────────────────────────
type NodeData = {
  label: string;
  horas: string;
  visualEstado: VisualEstado;
  highlighted: boolean;
  dimmed: boolean;
};

type AgrupadorNodeData = {
  nombre: string;
  cantidad: number;
  dimmed: boolean;
};

// ── Custom node: materia ──────────────────────────────────────────────────────
function MateriaNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const { label, horas, visualEstado, highlighted, dimmed } = data;
  const s = STATE_STYLE[visualEstado];
  const opacity = dimmed ? 0.1 : visualEstado === "bloqueada" ? 0.35 : 1;
  const ringBorder = highlighted ? `2px solid ${s.text}` : `1px solid ${s.border}`;

  return (
    <div
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        background: s.bg,
        border: selected ? `2px solid ${s.text}` : ringBorder,
        borderLeft: `3px solid ${s.text}`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        opacity,
        backdropFilter: "blur(8px)",
        boxShadow: highlighted ? `0 0 0 3px ${s.text}44` : "none",
        transition: "opacity 0.15s, box-shadow 0.15s",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: s.text, width: 8, height: 8, border: "none" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word" }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: s.text,
          background: `${s.bg}99`, border: `1px solid ${s.border}`,
          borderRadius: 4, padding: "1px 5px",
        }}>
          {getStateLabel(visualEstado)}
        </span>
        <span style={{ fontSize: 9, color: TEXT_DET }}>{horas}h</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: s.text, width: 8, height: 8, border: "none" }} />
    </div>
  );
}

// ── Custom node: agrupador ────────────────────────────────────────────────────
function AgrupadorNode({ data }: NodeProps<Node<AgrupadorNodeData>>) {
  const { nombre, cantidad, dimmed } = data;
  return (
    <div style={{
      width: NODE_W, minHeight: NODE_H,
      background: "rgba(157,78,221,0.08)",
      border: "1.5px dashed rgba(157,78,221,0.45)",
      borderRadius: 10, padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: 4,
      backdropFilter: "blur(8px)",
      opacity: dimmed ? 0.1 : 1,
      transition: "opacity 0.15s",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: ACCENT, width: 8, height: 8, border: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, lineHeight: 1.3, wordBreak: "break-word" }}>
        {nombre}
      </div>
      <span style={{ fontSize: 9, color: TEXT_SEC, marginTop: "auto" }}>
        {cantidad} {cantidad === 1 ? "opción" : "opciones"}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: ACCENT, width: 8, height: 8, border: "none" }} />
    </div>
  );
}

const nodeTypes = { materia: MateriaNode, agrupador: AgrupadorNode };

// ── Build graph (positions only, no filter/opacity — those go on node.data) ──
function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>,
): {
  nodes: Node[];
  edges: Edge[];
  materiaById: Map<string, Materia>;
  vmById: Map<string, VisualEstado>;
  blockedTargets: Set<string>;
} {
  const materiaById = new Map(materias.map((m) => [String(m.id), m]));

  const normales = materias.filter(
    (m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion && m.año && m.cuatrimestre
  );

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

  const extractNum = (s: string) => { const m = s.match(/\d+/); return m ? parseInt(m[0], 10) : 0; };

  const allPairs = [
    ...normales.map((m) => ({ año: m.año!, cuatrimestre: m.cuatrimestre! })),
    ...agrupadorItems.map((a) => ({ año: a.año, cuatrimestre: a.cuatrimestre })),
  ];

  const uniquePairs = Array.from(
    new Map(allPairs.map((p) => [`${p.año}|${p.cuatrimestre}`, p])).values()
  ).sort((a, b) => {
    const d = extractNum(a.año) - extractNum(b.año);
    return d !== 0 ? d : extractNum(a.cuatrimestre) - extractNum(b.cuatrimestre);
  });

  const colIndex = new Map(uniquePairs.map((p, i) => [`${p.año}|${p.cuatrimestre}`, i]));
  const colRowCount = new Map<string, number>();
  const posMap = new Map<string, { x: number; y: number }>();

  const assignPos = (id: string, año: string, cuatrimestre: string) => {
    const key = `${año}|${cuatrimestre}`;
    const col = colIndex.get(key) ?? 0;
    const row = colRowCount.get(key) ?? 0;
    colRowCount.set(key, row + 1);
    posMap.set(id, { x: col * COL_W, y: row * ROW_H });
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

  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();
  const blockedTargets = new Set<string>();

  for (const m of normales) {
    const targetId = String(m.id);
    const isTargetBlocked = vmById.get(targetId) === "bloqueada";
    for (const [reqId] of Object.entries(m.correlativas ?? {})) {
      if (!visibleIds.has(reqId)) continue;
      const edgeId = `${reqId}->${targetId}`;
      if (edgeSeen.has(edgeId)) continue;
      edgeSeen.add(edgeId);
      if (isTargetBlocked) blockedTargets.add(edgeId);
      edges.push({
        id: edgeId,
        source: reqId,
        target: targetId,
        type: "smoothstep",
        style: {
          stroke: isTargetBlocked ? "rgba(157,78,221,0.15)" : "rgba(157,78,221,0.45)",
          strokeWidth: 1.5,
          opacity: isTargetBlocked ? 0.25 : 1,
        },
        animated: false,
      });
    }
  }

  const nodes: Node[] = [
    ...normales.map((m) => ({
      id: String(m.id),
      type: "materia",
      position: posMap.get(String(m.id)) ?? { x: 0, y: 0 },
      data: {
        label: m.nombre,
        horas: m.horas ?? "?",
        visualEstado: vmById.get(String(m.id)) ?? "bloqueada",
        highlighted: false,
        dimmed: false,
      } satisfies NodeData,
    })),
    ...agrupadorItems.map((a) => ({
      id: String(a.id),
      type: "agrupador",
      position: posMap.get(String(a.id)) ?? { x: 0, y: 0 },
      data: { nombre: a.nombre, cantidad: a.opciones.length, dimmed: false } satisfies AgrupadorNodeData,
    })),
  ];

  return { nodes, edges, materiaById, vmById, blockedTargets };
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  nodeId,
  materias,
  agrupadores,
  idsAgrupadores,
  estados,
  vmById,
  onClose,
  onVerEnPlan,
}: {
  nodeId: string;
  materias: Materia[];
  agrupadores: Agrupador[];
  idsAgrupadores: Set<string>;
  estados: Record<string, EstadoMateria>;
  vmById: Map<string, VisualEstado>;
  onClose: () => void;
  onVerEnPlan?: () => void;
}) {
  const materiaById = useMemo(() => new Map(materias.map((m) => [String(m.id), m])), [materias]);
  const materia = materiaById.get(nodeId);
  if (!materia) return null;

  const ve = vmById.get(nodeId) ?? "bloqueada";
  const s = STATE_STYLE[ve];

  // Correlativas previas
  const previas = Object.keys(materia.correlativas ?? {}).map((id) => ({
    id,
    nombre: materiaById.get(id)?.nombre ?? id,
    ve: vmById.get(id) ?? ("bloqueada" as VisualEstado),
  }));

  // Materias que esta habilita (inverso del grafo)
  const habilita = materias
    .filter((m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion)
    .filter((m) => Object.keys(m.correlativas ?? {}).includes(nodeId))
    .map((m) => ({
      id: String(m.id),
      nombre: m.nombre,
      ve: vmById.get(String(m.id)) ?? ("bloqueada" as VisualEstado),
    }));

  return (
    <div
      style={{
        background: "rgba(15,20,50,0.95)",
        border: `1px solid ${GLASS.raised}`,
        borderRadius: 12,
        padding: "14px 16px",
        width: 260,
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, flex: 1 }}>
          {materia.nombre}
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      {/* State badge */}
      <span style={{
        alignSelf: "flex-start",
        fontSize: 10, fontWeight: 600, color: s.text,
        background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: 5, padding: "2px 8px",
      }}>
        {getStateLabel(ve)}
      </span>

      {/* Previas */}
      {previas.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: TEXT_SEC, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Correlativas previas
          </div>
          {previas.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATE_STYLE[p.ve].text, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: TEXT_DET, lineHeight: 1.3 }}>{p.nombre}</span>
            </div>
          ))}
        </div>
      )}

      {/* Habilita */}
      {habilita.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: TEXT_SEC, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Habilita
          </div>
          {habilita.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATE_STYLE[h.ve].text, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: TEXT_DET, lineHeight: 1.3 }}>{h.nombre}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ver en Plan */}
      {onVerEnPlan && (
        <button
          onClick={onVerEnPlan}
          style={{
            background: "rgba(157,78,221,0.15)",
            border: `1px solid rgba(157,78,221,0.4)`,
            borderRadius: 7,
            color: "#c4a0f0",
            fontSize: 11,
            fontWeight: 600,
            padding: "6px 10px",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          Ver en Plan
        </button>
      )}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
type FiltroEstado = "todas" | VisualEstado;

function Toolbar({
  filtro,
  onFiltro,
  busqueda,
  onBusqueda,
  contadores,
  onBuscar,
}: {
  filtro: FiltroEstado;
  onFiltro: (f: FiltroEstado) => void;
  busqueda: string;
  onBusqueda: (s: string) => void;
  contadores: Record<VisualEstado, number>;
  onBuscar: () => void;
}) {
  const chips: { key: FiltroEstado; label: string }[] = [
    { key: "todas",     label: "Todas" },
    { key: "aprobada",  label: "Aprobada" },
    { key: "cursada",   label: "Cursada" },
    { key: "disponible",label: "Disponible" },
    { key: "bloqueada", label: "Bloqueada" },
  ];

  const total = Object.values(contadores).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
      padding: "8px 12px",
      background: GLASS.dim,
      border: `1px solid ${GLASS.raised}`,
      borderRadius: 10,
    }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Buscar materia..."
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onBuscar()}
        style={{
          background: GLASS.elevated,
          border: `1px solid ${GLASS.strong}`,
          borderRadius: 7,
          color: TEXT,
          fontSize: 12,
          padding: "5px 10px",
          outline: "none",
          width: 180,
        }}
      />

      {/* Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {chips.map(({ key, label }) => {
          const active = filtro === key;
          const accentColor = key === "todas"
            ? ACCENT
            : STATE_STYLE[key as VisualEstado].text;
          return (
            <button
              key={key}
              onClick={() => onFiltro(key)}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 6,
                border: active ? `1px solid ${accentColor}` : `1px solid ${GLASS.border}`,
                background: active ? `${accentColor}22` : GLASS.base,
                color: active ? accentColor : TEXT_SEC,
                cursor: "pointer",
                transition: "all 0.1s",
              }}
            >
              {label}
              {key !== "todas" && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>
                  {contadores[key as VisualEstado]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contadores */}
      <span style={{ fontSize: 10, color: TEXT_SEC, marginLeft: "auto" }}>
        {contadores.aprobada} aprobadas · {contadores.cursada} cursando · {contadores.disponible} disponibles · {contadores.bloqueada} bloqueadas · {total} total
      </span>
    </div>
  );
}

// ── Inner component (needs ReactFlow context) ─────────────────────────────────
function MapaInner({
  materias,
  agrupadores,
  idsAgrupadores,
  estados,
  onVerEnPlan,
}: Props) {
  const { fitView, fitBounds, getNode } = useReactFlow();

  const { nodes: baseNodes, edges: baseEdges, materiaById, vmById } = useMemo(
    () => buildGraph(materias, agrupadores, idsAgrupadores, estados),
    [materias, agrupadores, idsAgrupadores, estados]
  );

  const [filtro, setFiltro] = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [minimapVisible, setMinimapVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("mapaMinimapVisible");
    return stored === null ? true : stored === "true";
  });

  const toggleMinimap = useCallback(() => {
    setMinimapVisible((v) => {
      const next = !v;
      localStorage.setItem("mapaMinimapVisible", String(next));
      return next;
    });
  }, []);

  // Compute display nodes with dimmed/highlighted applied
  const displayNodes = useMemo<Node[]>(() => {
    return baseNodes.map((n) => {
      if (n.type === "agrupador") {
        return { ...n, data: { ...n.data, dimmed: filtro !== "todas" } };
      }
      const ve = vmById.get(n.id) ?? "bloqueada";
      const dimmed = filtro !== "todas" && ve !== filtro;
      const highlighted = n.id === highlightedId;
      return {
        ...n,
        data: { ...n.data, dimmed, highlighted },
        selected: n.id === selectedNodeId,
      };
    });
  }, [baseNodes, filtro, highlightedId, selectedNodeId, vmById]);

  const [nodes, setNodes, onNodesChange] = useNodesState(displayNodes);
  const [edges, , onEdgesChange] = useEdgesState(baseEdges);

  // Sync displayNodes into ReactFlow state when they change
  useEffect(() => {
    setNodes(displayNodes);
  }, [displayNodes, setNodes]);

  // Contadores
  const contadores = useMemo<Record<VisualEstado, number>>(() => {
    const counts: Record<VisualEstado, number> = { aprobada: 0, cursada: 0, disponible: 0, bloqueada: 0 };
    for (const [, ve] of vmById) counts[ve]++;
    return counts;
  }, [vmById]);

  // Initial fitView on active nodes (disponible + cursada), else all
  const didInitialFit = useRef(false);
  const handleInit = useCallback(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;

    const activeNodes = baseNodes.filter((n) => {
      const ve = vmById.get(n.id);
      return ve === "disponible" || ve === "cursada";
    });

    if (activeNodes.length > 0) {
      const xs = activeNodes.map((n) => n.position.x);
      const ys = activeNodes.map((n) => n.position.y);
      fitBounds(
        {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs) + NODE_W,
          height: Math.max(...ys) - Math.min(...ys) + NODE_H,
        },
        { padding: 0.3, duration: 400 }
      );
    } else {
      fitView({ padding: 0.15, duration: 400 });
    }
  }, [baseNodes, vmById, fitBounds, fitView]);

  // fitAll (button + keyboard)
  const fitAll = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 });
  }, [fitView]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        fitAll();
      }
      if (e.key === "Escape") setSelectedNodeId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fitAll]);

  // Search: fit to matching node
  const handleBuscar = useCallback(() => {
    if (!busqueda.trim()) return;
    const q = busqueda.toLowerCase();
    const match = baseNodes.find(
      (n) => n.type === "materia" && (n.data as NodeData).label.toLowerCase().includes(q)
    );
    if (!match) return;
    setHighlightedId(match.id);
    setSelectedNodeId(match.id);
    fitBounds(
      { x: match.position.x, y: match.position.y, width: NODE_W, height: NODE_H },
      { padding: 0.5, duration: 500 }
    );
    setTimeout(() => setHighlightedId(null), 2000);
  }, [busqueda, baseNodes, fitBounds]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== "materia") return;
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedMateria = selectedNodeId ? materiaById.get(selectedNodeId) : null;

  return (
    <div style={{ position: "relative" }}>
      <Toolbar
        filtro={filtro}
        onFiltro={setFiltro}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        contadores={contadores}
        onBuscar={handleBuscar}
      />

      <div style={{
        width: "100%", height: "72vh", minHeight: 480,
        borderRadius: 14, overflow: "hidden",
        border: `1px solid ${GLASS.raised}`,
        background: "rgba(15,20,50,0.55)",
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onInit={handleInit}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.4}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />

          <Controls style={{ background: GLASS.base, border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}>
            <ControlButton onClick={fitAll} title="Ajustar vista (F)" style={{ fontSize: 11, fontWeight: 700, color: TEXT_SEC }}>
              F
            </ControlButton>
            <ControlButton
              onClick={toggleMinimap}
              title={minimapVisible ? "Ocultar minimapa" : "Mostrar minimapa"}
              style={{ fontSize: 9, fontWeight: 700, color: TEXT_SEC }}
            >
              {minimapVisible ? "▪" : "▫"}
            </ControlButton>
          </Controls>

          {minimapVisible && (
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "agrupador") return ACCENT;
                const ve = vmById.get(node.id) ?? "bloqueada";
                return STATE_STYLE[ve].text;
              }}
              style={{ background: "rgba(15,20,50,0.8)", border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}
              maskColor="rgba(0,0,0,0.4)"
            />
          )}

          {selectedMateria && selectedNodeId && (
            <Panel position="top-right">
              <DetailPanel
                nodeId={selectedNodeId}
                materias={materias}
                agrupadores={agrupadores}
                idsAgrupadores={idsAgrupadores}
                estados={estados}
                vmById={vmById}
                onClose={() => setSelectedNodeId(null)}
                onVerEnPlan={onVerEnPlan}
              />
            </Panel>
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

// ── Public export (wraps with provider) ──────────────────────────────────────
export default function MapaPlan(props: Props) {
  return (
    <ReactFlowProvider>
      <MapaInner {...props} />
    </ReactFlowProvider>
  );
}
