import { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      /** Rol real en DB — solo presente cuando hay una simulación activa */
      realRole?: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    /** Rol simulado temporalmente por el admin — no persiste en DB */
    effectiveRole?: AppRole;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiresAt?: number;
  }
}
