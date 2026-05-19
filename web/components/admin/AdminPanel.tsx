"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ACCENT, BG_GRADIENT, GLASS, TEXT, TEXT_SEC } from "@/lib/ui/tokens";
import CargarPlanTab from "./tabs/CargarPlanTab";
import HistorialTab from "./tabs/HistorialTab";
import ConfigTab from "./tabs/ConfigTab";
import PlanesTab from "./tabs/PlanesTab";
import RoleSwitcher from "./RoleSwitcher";

type Tab = "cargar" | "planes" | "historial" | "config";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "cargar",    label: "Cargar plan",   icon: "↑" },
  { id: "planes",    label: "Planes",        icon: "☰" },
  { id: "historial", label: "Historial",     icon: "◷" },
  { id: "config",    label: "Configuración", icon: "⚙" },
];

const VALID_TABS = new Set<Tab>(["cargar", "planes", "historial", "config"]);

export default function AdminPanel({ canPublish = true }: { canPublish?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = (searchParams.get("tab") ?? "") as Tab;
  const initialTab: Tab = VALID_TABS.has(tabFromUrl) ? tabFromUrl : "cargar";
  const [tab, setTab] = useState<Tab>(initialTab);
  // Rastrea qué tabs fueron visitados para montarlos solo cuando se necesitan
  const [mounted, setMounted] = useState<Set<Tab>>(new Set([initialTab]));

  function cambiarTab(t: Tab) {
    setTab(t);
    setMounted(prev => prev.has(t) ? prev : new Set([...prev, t]));
    const params = new URLSearchParams(searchParams.toString());
    if (t === "cargar") {
      params.delete("tab");
    } else {
      params.set("tab", t);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div style={{ background: BG_GRADIENT, minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      <style>{`
        .ap-header { padding: 0 20px; }
        .ap-row1 { display: flex; align-items: center; gap: 10px; height: 52px; }
        .ap-desktop-right { display: flex; margin-left: auto; align-items: center; gap: 10px; }
        .ap-perfil-desktop { display: inline-flex; }
        .ap-row2 { display: none; }
        .ap-tabs-nav { overflow-x: auto; -webkit-overflow-scrolling: touch; border-bottom: 1px solid ${GLASS.border}; margin-bottom: 28px; }
        .ap-tabs-inner { display: flex; gap: 4px; white-space: nowrap; min-width: max-content; }
        @media (max-width: 640px) {
          .ap-header { padding: 0 14px; }
          .ap-perfil-desktop { display: none !important; }
          .ap-desktop-right { display: none !important; }
          .ap-row2 {
            display: flex; align-items: center; gap: 8px;
            padding-bottom: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>

      {/* Topbar */}
      <header className="ap-header" style={{
        borderBottom: `1px solid ${GLASS.border}`,
        background: "rgba(10,14,40,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Fila 1: siempre visible */}
        <div className="ap-row1">
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link href="/" style={{
              fontSize: 12, color: TEXT_SEC, textDecoration: "none",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${GLASS.border}`,
              borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap",
            }}>
              ← Inicio
            </Link>
            <Link href="/perfil" className="ap-perfil-desktop" style={{
              fontSize: 12, color: TEXT_SEC, textDecoration: "none",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${GLASS.border}`,
              borderRadius: 8, padding: "4px 12px", whiteSpace: "nowrap",
              alignItems: "center",
            }}>
              Perfil
            </Link>
          </div>

          <span style={{ fontWeight: 700, fontSize: 14, color: TEXT, whiteSpace: "nowrap", marginLeft: 4 }}>
            Panel de administración
          </span>

          <div className="ap-desktop-right">
            <RoleSwitcher />
            <span style={{
              background: "rgba(157,78,221,0.2)",
              border: `1px solid rgba(157,78,221,0.4)`,
              color: "#c084fc",
              borderRadius: 4, padding: "1px 8px",
              fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
            }}>Admin</span>
            <div style={{
              width: 28, height: 28,
              background: `linear-gradient(135deg, ${ACCENT}, #c084fc)`,
              borderRadius: 7,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>⚙</div>
          </div>
        </div>

        {/* Fila 2: solo mobile — Perfil + RoleSwitcher + badge */}
        <div className="ap-row2">
          <Link href="/perfil" style={{
            fontSize: 11, color: TEXT_SEC, textDecoration: "none",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${GLASS.border}`,
            borderRadius: 6, padding: "3px 10px",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            Perfil
          </Link>
          <div style={{ flexShrink: 0 }}><RoleSwitcher /></div>
          <span style={{
            background: "rgba(157,78,221,0.2)",
            border: `1px solid rgba(157,78,221,0.4)`,
            color: "#c084fc", borderRadius: 4, padding: "1px 8px",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", flexShrink: 0,
          }}>Admin</span>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px 56px" }}>
        {/* Tabs — scroll horizontal en mobile */}
        <nav className="ap-tabs-nav">
          <div className="ap-tabs-inner">
            {TABS.map(t => (
              <button className="btn-press"
                key={t.id}
                onClick={() => cambiarTab(t.id)}
                style={{
                  background: "none", border: "none",
                  color: tab === t.id ? "#c084fc" : TEXT_SEC,
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontSize: 13, fontWeight: 500,
                  borderBottom: tab === t.id ? `2px solid #c084fc` : "2px solid transparent",
                  marginBottom: -1,
                  transition: "all 0.15s",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ opacity: 0.8 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {mounted.has("cargar")    && <div style={{ display: tab === "cargar"    ? undefined : "none" }}><CargarPlanTab canPublish={canPublish} /></div>}
        {mounted.has("planes")    && <div style={{ display: tab === "planes"    ? undefined : "none" }}><PlanesTab /></div>}
        {mounted.has("historial") && <div style={{ display: tab === "historial" ? undefined : "none" }}><HistorialTab /></div>}
        {mounted.has("config")    && <div style={{ display: tab === "config"    ? undefined : "none" }}><ConfigTab canEdit={canPublish} /></div>}
      </main>
    </div>
  );
}
