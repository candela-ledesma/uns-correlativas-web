"use client";

import { useEffect, useState } from "react";
import { TEXT_SEC, SURFACE, BTN, BTN_VIOLET, INPUT } from "@/lib/ui/tokens";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/ai/prompt";

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

const DEFAULT_PROMPT = DEFAULT_SYSTEM_PROMPT;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ConfigTab() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.json())
      .then(({ config }) => {
        if (!config) return;
        if (typeof config.systemPrompt === "string") setPrompt(config.systemPrompt);
      })
      .catch(() => setLoadError("No se pudo cargar la configuración guardada."));
  }, []);

  async function guardar() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: prompt }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
    setTimeout(() => setSaveState("idle"), 2500);
  }

  function restaurar() {
    setPrompt(DEFAULT_PROMPT);
  }

  function copiarPrompt() {
    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1500);
  }

  return (
    <div>
      {loadError && (
        <div style={{
          marginBottom: 12, padding: "8px 14px", borderRadius: 8,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          fontSize: 12, color: "#fca5a5",
        }}>
          {loadError}
        </div>
      )}

      <div style={CARD}>
        <div style={LABEL}>API</div>
        <div>
          <label style={FIELD_LABEL}>API Key de Gemini</label>
          <input
            type="password"
            placeholder="Configurada vía GEMINI_API_KEY en .env"
            disabled
            style={{ ...INPUT, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "monospace", opacity: 0.6, cursor: "not-allowed" }}
          />
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
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button
            onClick={guardar}
            disabled={saveState === "saving"}
            style={{
              ...BTN_VIOLET, borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 600,
              opacity: saveState === "saving" ? 0.6 : 1,
              cursor: saveState === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : saveState === "error" ? "⚠ Error" : "💾 Guardar"}
          </button>
          <button
            onClick={copiarPrompt}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13,
              background: promptCopied ? "rgba(34,197,94,0.15)" : undefined,
              transition: "background 0.2s",
            }}
          >
            {promptCopied ? "✓ Copiado" : "📋 Copiar"}
          </button>
          <button
            onClick={restaurar}
            style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13 }}
          >
            ↩ Restaurar prompt
          </button>
          {saveState === "saved" && (
            <span style={{ fontSize: 11, color: "#22c55e" }}>Cambios aplicados al próximo parseo</span>
          )}
          {saveState === "error" && (
            <span style={{ fontSize: 11, color: "#fca5a5" }}>No se pudo guardar</span>
          )}
        </div>
      </div>
    </div>
  );
}
