"use client";

import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = "#1a1a2e";
    document.documentElement.style.background = "#1a1a2e";
    return () => {
      document.body.style.background = prev;
      document.documentElement.style.background = "";
    };
  }, []);

  return (
    <div style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)", minHeight: "100vh" }}>
      {children}
    </div>
  );
}
