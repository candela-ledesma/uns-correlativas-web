"use client";

import { useState } from "react";
import { ACCENT, GLASS, TEXT, TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT } from "@/lib/ui/tokens";

const CARD: React.CSSProperties = {
  ...SURFACE,
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12,
};

const FIELD_LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, color: TEXT_SEC,
  fontWeight: 500, marginBottom: 6,
};

const PROMPT_BASE = `You are a deterministic data normalization engine for academic curricula.

Your task is to transform raw, unstructured academic plan content into a strictly valid JSON object that follows the PlanData schema.

Extract ALL subjects including electives. Never invent or infer data — if not explicitly present, use null.

Return ONLY valid JSON. No explanations, no comments, no markdown.`;

export default function ConfigTab() {
  const [temp, setTemp] = useState(0);
  const [prompt, setPrompt] = useState(PROMPT_BASE);

  return (
    <div>
      <div style={CARD}>
        <div style={LABEL}>API</div>
        <div>
          <label style={FIELD_LABEL}>API Key de Gemini</label>
          <input
            type="password"
            defaultValue="AIzaSyDummyKeyForDemo1234567890"
            style={{ ...INPUT, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}
          />
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>Modelo</div>
        <div>
          <label style={FIELD_LABEL}>
            Temperatura{" "}
            <span style={{ color: "#c084fc", fontWeight: 600 }}>{temp}</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range" min={0} max={10} step={1} value={temp}
              onChange={e => setTemp(Number(e.target.value))}
              style={{ flex: 1, accentColor: ACCENT, cursor: "pointer" }}
            />
            <span style={{ minWidth: 24, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#c084fc" }}>{temp}</span>
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>Prompt del parser</div>
        <div>
          <label style={FIELD_LABEL}>System prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={8}
            style={{
              ...INPUT, borderRadius: 8, padding: "10px 12px",
              fontSize: 12, lineHeight: 1.6, resize: "vertical",
              fontFamily: "monospace",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ ...BTN_VIOLET, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>
            ✨ Mejorar prompt
          </button>
          <button style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13 }}>
            💾 Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
