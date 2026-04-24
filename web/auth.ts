import { getServerSession } from "next-auth/next";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { createAuditEvent } from "@/lib/db/audit";
import { isRole } from "@/lib/auth/authz";
import { Role } from "@/lib/auth/roles";
import { getAuthProviderFlags } from "@/lib/auth/authProviders";

if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}

if (!process.env.NEXTAUTH_SECRET && process.env.AUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
}

const { hasGoogleProvider, allowDevLogin, isProduction } = getAuthProviderFlags();

const allowDevRoleOverride =
  process.env.AUTH_ALLOW_DEV_ROLE_OVERRIDE === "true" ||
  (!isProduction && process.env.AUTH_ALLOW_DEV_ROLE_OVERRIDE !== "false");

const devLoginAllowlist = new Set(
  (process.env.AUTH_DEV_LOGIN_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function isAllowedDevEmail(email: string) {
  if (devLoginAllowlist.size === 0) return true;
  return devLoginAllowlist.has(email);
}

const providers: NonNullable<NextAuthOptions["providers"]> = [];

if (hasGoogleProvider) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET as string,
    }),
  );
}

if (allowDevLogin) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        role: { label: "Role", type: "text" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!email) return null;

        if (!isAllowedDevEmail(email)) return null;

        const requestedRole = String(credentials?.role ?? "USER").toUpperCase();
        const candidateRole = allowDevRoleOverride ? requestedRole : "USER";
        const role = isRole(candidateRole) ? candidateRole : "USER";

        const user = await prisma.user.upsert({
          where: { email },
          update: { role },
          create: {
            email,
            name: email.split("@")[0],
            role,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  );
}

if (providers.length === 0) {
  providers.push(
    Credentials({
      id: "disabled-login",
      name: "Disabled Login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      authorize: async () => null,
    }),
  );

  console.warn(
    "No hay providers de autenticacion configurados. La autenticacion quedara deshabilitada hasta configurar Google o AUTH_ENABLE_DEV_LOGIN=true.",
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.sub = user.id;
        const roleFromUser = (user as { role?: string }).role;

        if (roleFromUser && isRole(roleFromUser)) {
          token.role = roleFromUser;
        } else {
          token.role = Role.USER;
        }
      }

      if (token.sub && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true },
        });

        token.role = dbUser?.role ?? Role.USER;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role =
          token.role === Role.ADMIN
            ? Role.ADMIN
            : token.role === Role.MODERATOR
              ? Role.MODERATOR
              : Role.USER;
      }

      return session;
    },
  },
  events: {
    signIn: async ({ user, account, isNewUser }) => {
      await createAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email,
        actorRole: (user as { role?: string }).role === Role.ADMIN
          ? Role.ADMIN
          : (user as { role?: string }).role === Role.MODERATOR
            ? Role.MODERATOR
            : Role.USER,
        authProvider: account?.provider ?? "unknown",
        action: isNewUser ? "AUTH_SIGNUP" : "AUTH_SIGNIN",
        entityType: "user",
        entityId: user.id,
        reason: "Inicio de sesion",
        metadata: {
          provider: account?.provider,
          isNewUser,
        },
      });
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
