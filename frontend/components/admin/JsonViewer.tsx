"use client";

import { forwardRef, useMemo } from "react";
import { GLASS, TEXT_SEC } from "@/lib/ui/tokens";
import type { DiffItem } from "./tabs/DiffExportDrawer";

type Props = {
  json: object;
  diffs: DiffItem[];
  fuente: "gemini" | "parser";
  activeDiffId: string | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  brokenIds?: Set<string>;
};

type LineInfo = {
  text: string;
  diffId: string | null;
  tooltip: string | null;
  highlight: "bad" | "good" | "neutral" | "broken" | null;
};

function buildLineMap(
  jsonStr: string,
  diffs: DiffItem[],
  fuente: "gemini" | "parser",
  brokenIds?: Set<string>,
): LineInfo[] {
  const lines = jsonStr.split("\n");

  // Agrupar todos los diffs por ID — una materia puede tener correlativa_distinta + requisito_distinto
  const diffsByIdMap = new Map<string, DiffItem[]>();
  for (const d of diffs) {
    const arr = diffsByIdMap.get(d.id) ?? [];
    arr.push(d);
    diffsByIdMap.set(d.id, arr);
  }

  const esGroundTruth = fuente === "parser";

  function infoForDiffs(id: string): { tooltip: string; highlight: "bad" | "good" | "neutral" } {
    const items = diffsByIdMap.get(id) ?? [];
    const tooltip = items.map(buildTooltip).join("\n\n");
    // El highlight más severo gana: bad > good > neutral
    const highlights = items.map(d => highlightFor(d, esGroundTruth));
    const highlight = highlights.includes("bad") ? "bad" : highlights.includes("good") ? "good" : "neutral";
    return { tooltip, highlight };
  }

  let currentDiffId: string | null = null;
  let depth = 0;
  let objStartDepth = -1;

  return lines.map(line => {
    // Detectar apertura/cierre de objetos para trackear bloque de materia
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    // Detectar si esta línea introduce un id de materia con diff
    const idMatch = line.match(/"id"\s*:\s*"([^"]+)"/);
    if (idMatch && diffsByIdMap.has(idMatch[1])) {
      currentDiffId = idMatch[1];
      objStartDepth = depth;
    }

    depth += opens - closes;

    // Si cerramos el bloque de la materia actual
    if (currentDiffId !== null && depth <= objStartDepth && closes > 0) {
      const id = currentDiffId;
      currentDiffId = null;
      objStartDepth = -1;
      const { tooltip, highlight } = infoForDiffs(id);
      return { text: line, diffId: id, tooltip, highlight };
    }

    if (currentDiffId !== null) {
      const { tooltip, highlight } = infoForDiffs(currentDiffId);
      return { text: line, diffId: currentDiffId, tooltip, highlight };
    }

    // Detectar IDs rotas en líneas de correlativas (clave de objeto dentro de "correlativas")
    if (brokenIds && brokenIds.size > 0) {
      const keyMatch = line.match(/^\s+"([^"]+)"\s*:/);
      if (keyMatch && brokenIds.has(keyMatch[1])) {
        return {
          text: line,
          diffId: null,
          tooltip: `ID "${keyMatch[1]}" no existe en materias ni agrupadores`,
          highlight: "broken",
        };
      }
    }

    return { text: line, diffId: null, tooltip: null, highlight: null };
  });
}

function highlightFor(
  diff: DiffItem,
  esGroundTruth: boolean,
): "bad" | "good" | "neutral" {
  if (diff.tipo === "materia_extra") {
    // Materia extra: está en Gemini pero no en parser
    return esGroundTruth ? "neutral" : "bad";
  }
  if (diff.tipo === "materia_faltante" || diff.tipo === "agrupador_faltante") {
    // Faltante: está en parser pero no en Gemini
    return esGroundTruth ? "good" : "bad";
  }
  // correlativa_distinta / agrupador_distinto
  return esGroundTruth ? "good" : "bad";
}

function buildTooltip(diff: DiffItem): string {
  switch (diff.tipo) {
    case "correlativa_distinta":
      return `Parser: ${diff.groundTruth}\nGemini: ${diff.gemini}`;
    case "materia_faltante":
      return `Faltante en Gemini: ${diff.nombre}`;
    case "agrupador_faltante":
      return `Agrupador faltante en Gemini: ${diff.nombre}`;
    case "materia_extra":
      return `Extra en Gemini (no estaba en parser): ${diff.nombre}`;
    case "agrupador_distinto":
      return `Parser: ${diff.groundTruth}\nGemini: ${diff.gemini}`;
    case "requisito_distinto":
      return `Requisito — Parser: ${diff.groundTruth}\nGemini: ${diff.gemini}`;
    case "materia_sin_anio":
      return `Año/cuatrimestre — Parser: ${diff.groundTruth}\nGemini: ${diff.gemini}`;
  }
}

const BG: Record<NonNullable<LineInfo["highlight"]>, string> = {
  bad:     "rgba(231,111,81,0.12)",
  good:    "rgba(34,197,94,0.08)",
  neutral: "rgba(249,199,79,0.08)",
  broken:  "rgba(245,158,11,0.15)",
};

const BORDER: Record<NonNullable<LineInfo["highlight"]>, string> = {
  bad:     "rgba(231,111,81,0.5)",
  good:    "rgba(34,197,94,0.4)",
  neutral: "rgba(249,199,79,0.4)",
  broken:  "rgba(245,158,11,0.7)",
};

const JsonViewer = forwardRef<HTMLDivElement, Props>(function JsonViewer(
  { json, diffs, fuente, activeDiffId, onScroll, brokenIds },
  ref,
) {
  const jsonStr = useMemo(() => JSON.stringify(json, null, 2), [json]);
  const lines = useMemo(
    () => buildLineMap(jsonStr, diffs, fuente, brokenIds),
    [jsonStr, diffs, fuente, brokenIds],
  );

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      style={{
        overflow: "auto",
        maxHeight: 440,
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 10,
        lineHeight: "1.7",
      }}
    >
      {lines.map((line, i) => {
        const isActive = line.diffId !== null && line.diffId === activeDiffId;
        const bg = line.highlight ? BG[line.highlight] : "transparent";
        const borderLeft = line.highlight
          ? `2px solid ${BORDER[line.highlight]}`
          : "2px solid transparent";

        const idMatch2 = line.text.match(/"id"\s*:\s*"([^"]+)"/);
        return (
          <div
            key={i}
            data-diff-id={line.diffId ?? undefined}
            data-materia-id={idMatch2?.[1] ?? undefined}
            title={line.tooltip ?? undefined}
            style={{
              padding: "0 12px",
              background: isActive
                ? line.highlight === "bad"
                  ? "rgba(231,111,81,0.22)"
                  : "rgba(34,197,94,0.18)"
                : bg,
              borderLeft,
              cursor: line.tooltip ? "help" : "default",
              whiteSpace: "pre",
              wordBreak: "break-all",
              color: TEXT_SEC,
              transition: "background 0.15s",
            }}
          >
            <span style={{ userSelect: "none", color: GLASS.border, marginRight: 8, fontSize: 9 }}>
              {String(i + 1).padStart(4, " ")}
            </span>
            {line.text}
          </div>
        );
      })}
    </div>
  );
});

export default JsonViewer;
