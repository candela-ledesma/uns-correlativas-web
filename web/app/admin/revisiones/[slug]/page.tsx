"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BG_GRADIENT, GLASS, SURFACE, TEXT, TEXT_SEC, BTN } from "@/lib/ui/tokens";

export default function RevisionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/planes/pendientes/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.text();
      })
      .then(text => {
        // Pretty-print si es JSON válido
        try {
          setJson(JSON.stringify(JSON.parse(text), null, 2));
        } catch {
          setJson(text);
        }
      })
      .catch(e => setError(e.message));
  }, [slug]);

  function copiar() {
    if (!json) return;
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ background: BG_GRADIENT, minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 28px", height: 52,
        borderBottom: `1px solid ${GLASS.border}`,
        background: "rgba(10,14,40,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 16, opacity: 0.7 }}>⏳</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>
          Revisión pendiente
        </span>
        <span style={{
          background: "rgba(245,158,11,0.15)",
          border: "1px solid rgba(245,158,11,0.35)",
          color: "#f59e0b",
          borderRadius: 4, padding: "1px 8px",
          fontSize: 10, fontWeight: 600,
        }}>
          {slug}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={copiar}
            disabled={!json}
            style={{
              ...BTN, borderRadius: 8, padding: "4px 14px",
              fontSize: 12, cursor: json ? "pointer" : "not-allowed",
              opacity: json ? 1 : 0.4,
            }}
          >
            {copied ? "✓ Copiado" : "Copiar JSON"}
          </button>
          <button
            onClick={() => window.close()}
            style={{
              ...BTN, borderRadius: 8, padding: "4px 14px",
              fontSize: 12, cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px 56px" }}>
        {!json && !error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: TEXT_SEC, fontSize: 13 }}>
            Cargando…
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#f87171", fontSize: 13 }}>
            {error}
          </div>
        )}

        {json && (
          <div style={{ ...SURFACE, borderRadius: 12, padding: "20px 22px" }}>
            <pre style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.65,
              color: TEXT,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              {json}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
