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
  onVerEnPlan?: () => void;
};

// ── Layout constants ─────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 70;
const GAP_X  = 56;
const GAP_Y  = 20;
const COL_W  = NODE_W + GAP_X;
const ROW_H  = NODE_H + GAP_Y;

// ── State colors ─────────────────────────────────────────────────────────────
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

// ── Ancestor / descendant traversal (pure, O(E)) ─────────────────────────────
function getAncestors(nodeId: string, edges: Edge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const e of edges) {
      if (e.target === cur && !result.has(e.source)) {
        result.add(e.source);
        queue.push(e.source);
      }
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
      if (e.source === cur && !result.has(e.target)) {
        result.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return result;
}

// ── Node data types ───────────────────────────────────────────────────────────
// NOTE: hover state is NOT stored in NodeData — it's applied via CSS injection
// to avoid the setNodes → re-render → mouse-event cycle that causes flickering.
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
  const baseOpacity = dimmed ? 0.1 : visualEstado === "bloqueada" ? 0.35 : 1;
  const ringBorder = highlighted ? `2px solid ${s.text}` : `1px solid ${s.border}`;
  const shadow = highlighted ? `0 0 0 3px ${s.text}44` : "none";

  return (
    <div
      // data-ve is used by the CSS hover injection to target this node
      data-ve={visualEstado}
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        background: s.bg,
        borderTop: selected ? `2px solid ${s.text}` : ringBorder,
        borderRight: selected ? `2px solid ${s.text}` : ringBorder,
        borderBottom: selected ? `2px solid ${s.text}` : ringBorder,
        borderLeft: `3px solid ${s.text}`,
        borderRadius: 10,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        opacity: baseOpacity,
        backdropFilter: "blur(8px)",
        boxShadow: shadow,
        transition: "opacity 0.12s, box-shadow 0.12s",
        cursor: "pointer",
        pointerEvents: "all",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: s.text, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT, lineHeight: 1.3, wordBreak: "break-word", pointerEvents: "none" }}>
        {label}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", pointerEvents: "none" }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: s.text,
          background: `${s.bg}99`, border: `1px solid ${s.border}`,
          borderRadius: 4, padding: "1px 5px",
        }}>
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
      background: "rgba(157,78,221,0.08)",
      border: "1.5px dashed rgba(157,78,221,0.45)",
      borderRadius: 10, padding: "8px 10px",
      display: "flex", flexDirection: "column", gap: 4,
      backdropFilter: "blur(8px)",
      opacity: dimmed ? 0.1 : 1,
      transition: "opacity 0.12s",
      pointerEvents: "all",
    }}>
      <Handle type="target" position={Position.Left} style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, lineHeight: 1.3, wordBreak: "break-word", pointerEvents: "none" }}>
        {nombre}
      </div>
      <span style={{ fontSize: 9, color: TEXT_SEC, marginTop: "auto", pointerEvents: "none" }}>
        {cantidad} {cantidad === 1 ? "opción" : "opciones"}
      </span>
      <Handle type="source" position={Position.Right} style={{ background: ACCENT, width: 8, height: 8, border: "none", pointerEvents: "none" }} />
    </div>
  );
}

const nodeTypes = { materia: MateriaNode, agrupador: AgrupadorNode };

// ── Build graph ───────────────────────────────────────────────────────────────
function buildGraph(
  materias: Materia[],
  agrupadores: Agrupador[],
  idsAgrupadores: Set<string>,
  estados: Record<string, EstadoMateria>,
  selectedOrientacion: string,
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
      passesOrientationFilter(m, selectedOrientacion, idsAgrupadores, agrupadores)
  );

  type AgrupadorConUbicacion = Agrupador & { año: string; cuatrimestre: string };
  const agrupadorItems: AgrupadorConUbicacion[] = agrupadores
    .map((a) => {
      // Skip agrupadores that don't pass the orientation filter
      const agAsMat = { id: a.id } as Materia;
      if (!passesOrientationFilter(agAsMat, selectedOrientacion, idsAgrupadores, agrupadores)) return null;
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

  for (const m of normales) {
    const targetId = String(m.id);
    const isTargetBlocked = vmById.get(targetId) === "bloqueada";
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

  return { nodes, edges, materiaById, vmById };
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({
  nodeId,
  materias,
  agrupadores,
  idsAgrupadores,
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

  const requiere = Object.keys(materia.correlativas ?? {}).map((id) => ({
    id,
    nombre: materiaById.get(id)?.nombre ?? id,
    ve: vmById.get(id) ?? ("bloqueada" as VisualEstado),
  }));

  const habilita = materias
    .filter((m) => !idsAgrupadores.has(String(m.id)) && !m.grupo_opcion)
    .filter((m) => Object.keys(m.correlativas ?? {}).includes(nodeId))
    .map((m) => ({
      id: String(m.id),
      nombre: m.nombre,
      ve: vmById.get(String(m.id)) ?? ("bloqueada" as VisualEstado),
    }));

  const sectionTitle: React.CSSProperties = {
    fontSize: 10, color: TEXT_SEC, marginBottom: 4,
    fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
  };
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
    <div style={{
      background: "rgba(15,20,50,0.95)", border: `1px solid ${GLASS.raised}`,
      borderRadius: 12, padding: "14px 16px", width: 260,
      maxHeight: "70vh", overflowY: "auto",
      backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, lineHeight: 1.4, flex: 1 }}>{materia.nombre}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: TEXT_SEC, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      <span style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 600, color: s.text, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: "2px 8px" }}>
        {getStateLabel(ve)}
      </span>

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

      {onVerEnPlan && (
        <button onClick={onVerEnPlan} style={{
          background: "rgba(157,78,221,0.15)", border: `1px solid rgba(157,78,221,0.4)`,
          borderRadius: 7, color: "#c4a0f0", fontSize: 11, fontWeight: 600,
          padding: "6px 10px", cursor: "pointer", textAlign: "center",
        }}>
          Ver en Plan
        </button>
      )}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
type FiltroEstado = "todas" | VisualEstado;

function Toolbar({
  filtro, onFiltro, busqueda, onBusqueda, contadores, onBuscar,
}: {
  filtro: FiltroEstado;
  onFiltro: (f: FiltroEstado) => void;
  busqueda: string;
  onBusqueda: (s: string) => void;
  contadores: Record<VisualEstado, number>;
  onBuscar: () => void;
}) {
  const chips: { key: FiltroEstado; label: string }[] = [
    { key: "todas",      label: "Todas"      },
    { key: "aprobada",   label: "Aprobada"   },
    { key: "cursada",    label: "Cursada"    },
    { key: "disponible", label: "Disponible" },
    { key: "bloqueada",  label: "Bloqueada"  },
  ];
  const total = Object.values(contadores).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: GLASS.dim, border: `1px solid ${GLASS.raised}`, borderRadius: 10 }}>
      <input
        type="text" placeholder="Buscar materia..." value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onBuscar()}
        style={{ background: GLASS.elevated, border: `1px solid ${GLASS.strong}`, borderRadius: 7, color: TEXT, fontSize: 12, padding: "5px 10px", outline: "none", width: 180 }}
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
      <span style={{ fontSize: 10, color: TEXT_SEC, marginLeft: "auto" }}>
        {contadores.aprobada} aprobadas · {contadores.cursada} cursando · {contadores.disponible} disponibles · {contadores.bloqueada} bloqueadas · {total} total
      </span>
    </div>
  );
}

// ── HoverStyleInjector — renders a <style> tag, no node re-renders needed ────
// Lives inside ReactFlow so it can call useEdges() for the stable edge list.
function HoverStyleInjector({
  hoveredNodeId,
  activeChain,
  setEdges,
  baseEdges,
}: {
  hoveredNodeId: string | null;
  activeChain: Set<string> | null;
  setEdges: (edges: Edge[]) => void;
  baseEdges: Edge[];
}) {
  const liveEdges = useEdges();

  // Inject CSS that targets ReactFlow node wrappers by data-id attribute
  const css = useMemo(() => {
    if (!hoveredNodeId || !activeChain) return "";
    // All node wrappers not in chain → fade out
    // Node wrappers in chain → full opacity (override the base opacity set inline)
    // Hovered node → ring via outline
    const dimmed = `
      .react-flow__node:not([data-id="${Array.from(activeChain).join('"]):not([data-id="')}"]) {
        opacity: 0.06 !important;
        transition: opacity 0.12s;
      }
    `;
    const active = Array.from(activeChain).map((id) => `
      .react-flow__node[data-id="${id}"] {
        opacity: 1 !important;
        transition: opacity 0.12s;
      }
    `).join("");
    const hovered = `
      .react-flow__node[data-id="${hoveredNodeId}"] > div {
        box-shadow: 0 0 0 3px rgba(200,200,255,0.5) !important;
      }
    `;
    return dimmed + active + hovered;
  }, [hoveredNodeId, activeChain]);

  // Sync edge styles when hover changes — uses stable liveEdges ref from store
  useEffect(() => {
    if (!hoveredNodeId || !activeChain) {
      setEdges(baseEdges);
      return;
    }
    setEdges(
      liveEdges.map((e) => {
        const inChain = activeChain.has(e.source) && activeChain.has(e.target);
        return {
          ...e,
          style: inChain
            ? { stroke: "rgba(157,78,221,0.9)", strokeWidth: 2, opacity: 1 }
            : { stroke: "rgba(157,78,221,0.08)", strokeWidth: 1.5, opacity: 0.04 },
        };
      })
    );
  }, [hoveredNodeId, activeChain]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!css) return null;
  return <style>{css}</style>;
}

// ── Inner component ───────────────────────────────────────────────────────────
function MapaInner({ materias, agrupadores, idsAgrupadores, estados, onVerEnPlan }: Props) {
  const { fitView, getNodes, getNode, flowToScreenPosition } = useReactFlow();

  const [selectedOrientacion, setSelectedOrientacion] = useState("todas");

  const orientaciones = useMemo(
    () => extractOrientaciones(materias, agrupadores),
    [materias, agrupadores]
  );
  const hasOrientaciones = orientaciones.length > 0;

  const { nodes: baseNodes, edges: baseEdges, materiaById, vmById } = useMemo(
    () => buildGraph(materias, agrupadores, idsAgrupadores, estados, selectedOrientacion),
    [materias, agrupadores, idsAgrupadores, estados, selectedOrientacion]
  );

  const [filtro, setFiltro]               = useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda]           = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelSide, setPanelSide]         = useState<"left" | "right">("right");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [minimapVisible, setMinimapVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("mapaMinimapVisible");
    return stored === null ? true : stored === "true";
  });

  const isTouchDevice = useRef(
    typeof window !== "undefined" && window.matchMedia("(hover: none)").matches
  );

  // Debounced setter for hover enter (30ms), immediate for leave
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHoveredDebounced = useCallback((id: string | null) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (id === null) {
      setHoveredNodeId(null);
    } else {
      hoverTimerRef.current = setTimeout(() => setHoveredNodeId(id), 30);
    }
  }, []);

  // Active chain — recomputed only when hoveredNodeId changes
  const activeChain = useMemo<Set<string> | null>(() => {
    if (!hoveredNodeId) return null;
    const chain = new Set<string>([hoveredNodeId]);
    for (const id of getAncestors(hoveredNodeId, baseEdges)) chain.add(id);
    for (const id of getDescendants(hoveredNodeId, baseEdges)) chain.add(id);
    return chain;
  }, [hoveredNodeId, baseEdges]);

  // Display nodes — never changes due to hover (hover handled via CSS injection)
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
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges);

  useEffect(() => { setNodes(displayNodes); }, [displayNodes, setNodes]);

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

  // Initial fitView on disponible/cursada nodes
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    didInitialFit.current = true;
    setTimeout(() => {
      const activeIds = new Set(
        [...vmById.entries()]
          .filter(([, ve]) => ve === "disponible" || ve === "cursada")
          .map(([id]) => id)
      );
      if (activeIds.size > 0) {
        fitView({ nodes: getNodes().filter((n) => activeIds.has(n.id)), padding: 0.35, duration: 400 });
      } else {
        fitView({ padding: 0.15, duration: 400 });
      }
    }, 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fitAll = useCallback(() => fitView({ padding: 0.15, duration: 400 }), [fitView]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        fitAll();
      }
      if (e.key === "Escape") setSelectedNodeId(null);
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
    if (isTouchDevice.current || node.type !== "materia") return;
    setHoveredDebounced(node.id);
  }, [setHoveredDebounced]);

  const handleNodeMouseLeave = useCallback(() => {
    if (isTouchDevice.current) return;
    setHoveredDebounced(null);
  }, [setHoveredDebounced]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type !== "materia") return;
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
  }, [getNode, flowToScreenPosition]);

  const handlePaneClick = useCallback(() => setSelectedNodeId(null), []);

  const selectedMateria = selectedNodeId ? materiaById.get(selectedNodeId) : null;

  return (
    <div style={{ position: "relative" }}>
      {hasOrientaciones && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT_SEC, flexShrink: 0 }}>Orientación:</span>
          <select
            value={selectedOrientacion}
            onChange={(e) => { setSelectedOrientacion(e.target.value); setSelectedNodeId(null); }}
            style={{
              background: selectedOrientacion === "todas" ? GLASS.base : "rgba(157,78,221,0.15)",
              border: selectedOrientacion === "todas" ? `1px solid ${GLASS.raised}` : "1px solid rgba(157,78,221,0.45)",
              borderRadius: 7,
              color: selectedOrientacion === "todas" ? TEXT_SEC : "#c084fc",
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="todas">Todas las orientaciones</option>
            {orientaciones.map((ori) => (
              <option key={ori} value={ori}>{ori}</option>
            ))}
          </select>
        </div>
      )}

      <Toolbar
        filtro={filtro} onFiltro={setFiltro}
        busqueda={busqueda} onBusqueda={setBusqueda}
        contadores={contadores} onBuscar={handleBuscar}
      />

      <div style={{ width: "100%", height: "72vh", minHeight: 480, borderRadius: 14, overflow: "hidden", border: `1px solid ${GLASS.raised}`, background: "rgba(15,20,50,0.55)" }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
          minZoom={0.35} maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <HoverStyleInjector
            hoveredNodeId={hoveredNodeId}
            activeChain={activeChain}
            setEdges={setEdges}
            baseEdges={baseEdges}
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
                const ve = vmById.get(node.id) ?? "bloqueada";
                return STATE_STYLE[ve].text;
              }}
              style={{ background: "rgba(15,20,50,0.8)", border: `1px solid ${GLASS.raised}`, borderRadius: 8 }}
              maskColor="rgba(0,0,0,0.4)"
            />
          )}

          {selectedMateria && selectedNodeId && (
            <Panel position={panelSide === "left" ? "top-left" : "top-right"}>
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

// ── Public export ─────────────────────────────────────────────────────────────
export default function MapaPlan(props: Props) {
  return (
    <ReactFlowProvider>
      <MapaInner {...props} />
    </ReactFlowProvider>
  );
}
