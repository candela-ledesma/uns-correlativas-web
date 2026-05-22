"use client";

import { useEffect, useState } from "react";
import { TEXT_SEC, BTN, BTN_VIOLET, INPUT } from "@/lib/ui/tokens";
import { DEFAULT_SYSTEM_PROMPT, GENERIC_SYSTEM_PROMPT, PROMPT_VERSION, GENERIC_PROMPT_VERSION } from "@/lib/ai/prompt";

import { CARD, LABEL } from "./adminTabStyles";

const FIELD_LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, color: TEXT_SEC,
  fontWeight: 500, marginBottom: 6,
};

type SaveState = "idle" | "saving" | "saved" | "error";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ConfigTab({ canEdit = true }: { canEdit?: boolean }) {
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [genericPrompt, setGenericPrompt] = useState(GENERIC_SYSTEM_PROMPT);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [genericSaveState, setGenericSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [genericCopied, setGenericCopied] = useState(false);
  const [savedVersion, setSavedVersion] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.json())
      .then(({ config }) => {
        if (!config) return;
        if (typeof config.systemPrompt === "string") setPrompt(config.systemPrompt);
        if (typeof config.genericPrompt === "string") setGenericPrompt(config.genericPrompt);
        if (typeof config.version === "string") setSavedVersion(config.version);
        if (typeof config.updatedAt === "string") setSavedAt(config.updatedAt);
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
      if (res.ok) {
        const body = await res.json();
        if (body.version) setSavedVersion(body.version);
        if (body.updatedAt) setSavedAt(body.updatedAt);
        setSaveState("saved");
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
    setTimeout(() => setSaveState("idle"), 2500);
  }

  async function guardarGenerico() {
    setGenericSaveState("saving");
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genericPrompt }),
      });
      if (res.ok) {
        setGenericSaveState("saved");
      } else {
        setGenericSaveState("error");
      }
    } catch {
      setGenericSaveState("error");
    }
    setTimeout(() => setGenericSaveState("idle"), 2500);
  }

  function restaurar() { setPrompt(DEFAULT_SYSTEM_PROMPT); }
  function restaurarGenerico() { setGenericPrompt(GENERIC_SYSTEM_PROMPT); }

  function copiarPrompt() {
    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1500);
  }

  function copiarGenerico() {
    navigator.clipboard.writeText(genericPrompt);
    setGenericCopied(true);
    setTimeout(() => setGenericCopied(false), 1500);
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
        <div style={LABEL}>Prompt UNS</div>
        <div>
          <label style={FIELD_LABEL}>System prompt</label>
          <textarea
            value={prompt}
            onChange={canEdit ? e => setPrompt(e.target.value) : undefined}
            readOnly={!canEdit}
            rows={8}
            style={{
              ...INPUT, borderRadius: 8, padding: "10px 12px",
              fontSize: 12, lineHeight: 1.6, resize: "vertical",
              fontFamily: "monospace",
              opacity: canEdit ? 1 : 0.6,
              cursor: canEdit ? undefined : "default",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
          <span style={{
            fontSize: 11, color: TEXT_SEC,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "3px 8px",
            fontFamily: "monospace",
          }}>
            {savedVersion ?? PROMPT_VERSION}
          </span>
          {savedAt && (
            <span style={{ fontSize: 11, color: TEXT_SEC }}>
              Última modificación: {formatDate(savedAt)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          {canEdit && (
            <button className="btn-press"
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
          )}
          <button className="btn-press"
            onClick={copiarPrompt}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13,
              background: promptCopied ? "rgba(34,197,94,0.15)" : undefined,
              transition: "background 0.2s",
            }}
          >
            {promptCopied ? "✓ Copiado" : "📋 Copiar"}
          </button>
          {canEdit && (
            <button className="btn-press"
              onClick={restaurar}
              style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13 }}
            >
              ↩ Restaurar
            </button>
          )}
          {saveState === "saved" && (
            <span style={{ fontSize: 11, color: "#22c55e" }}>Cambios aplicados al próximo parseo</span>
          )}
          {saveState === "error" && (
            <span style={{ fontSize: 11, color: "#fca5a5" }}>No se pudo guardar</span>
          )}
        </div>
      </div>

      <div style={CARD}>
        <div style={LABEL}>Prompt genérico (otras universidades)</div>
        <div>
          <label style={FIELD_LABEL}>System prompt</label>
          <textarea
            value={genericPrompt}
            onChange={canEdit ? e => setGenericPrompt(e.target.value) : undefined}
            readOnly={!canEdit}
            rows={8}
            style={{
              ...INPUT, borderRadius: 8, padding: "10px 12px",
              fontSize: 12, lineHeight: 1.6, resize: "vertical",
              fontFamily: "monospace",
              opacity: canEdit ? 1 : 0.6,
              cursor: canEdit ? undefined : "default",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
          <span style={{
            fontSize: 11, color: TEXT_SEC,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 6, padding: "3px 8px",
            fontFamily: "monospace",
          }}>
            {GENERIC_PROMPT_VERSION}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          {canEdit && (
            <button className="btn-press"
              onClick={guardarGenerico}
              disabled={genericSaveState === "saving"}
              style={{
                ...BTN_VIOLET, borderRadius: 8, padding: "8px 16px",
                fontSize: 13, fontWeight: 600,
                opacity: genericSaveState === "saving" ? 0.6 : 1,
                cursor: genericSaveState === "saving" ? "not-allowed" : "pointer",
              }}
            >
              {genericSaveState === "saving" ? "Guardando…" : genericSaveState === "saved" ? "✓ Guardado" : genericSaveState === "error" ? "⚠ Error" : "💾 Guardar"}
            </button>
          )}
          <button className="btn-press"
            onClick={copiarGenerico}
            style={{
              ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13,
              background: genericCopied ? "rgba(34,197,94,0.15)" : undefined,
              transition: "background 0.2s",
            }}
          >
            {genericCopied ? "✓ Copiado" : "📋 Copiar"}
          </button>
          {canEdit && (
            <button className="btn-press"
              onClick={restaurarGenerico}
              style={{ ...BTN, borderRadius: 8, padding: "8px 16px", fontSize: 13 }}
            >
              ↩ Restaurar
            </button>
          )}
          {genericSaveState === "saved" && (
            <span style={{ fontSize: 11, color: "#22c55e" }}>Cambios aplicados al próximo parseo</span>
          )}
          {genericSaveState === "error" && (
            <span style={{ fontSize: 11, color: "#fca5a5" }}>No se pudo guardar</span>
          )}
        </div>
      </div>
    </div>
  );
}
