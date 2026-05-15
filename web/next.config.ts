import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir archivos de data/ en el bundle de Vercel (leídos via fs en runtime)
  outputFileTracingIncludes: {
    "/api/**": ["./data/**/*"],
    "/admin/**": ["./data/**/*"],
  },
};

export default nextConfig;
