import type { CSSProperties } from "react";
import { TEXT_SEC, SURFACE } from "@/lib/ui/tokens";

export const CARD: CSSProperties = {
  ...SURFACE,
  borderRadius: 12,
  padding: "20px 22px",
  marginBottom: 16,
};

export const LABEL: CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.06em", color: TEXT_SEC, marginBottom: 12,
};
