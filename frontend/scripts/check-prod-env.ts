#!/usr/bin/env node

import fs from "fs";
import path from "path";

type Severity = "error" | "warning";

type CheckResult = {
  severity: Severity;
  message: string;
};

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getBooleanEnv(name: string): boolean | undefined {
  const value = getEnv(name);
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function loadEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function printResults(results: CheckResult[]) {
  for (const result of results) {
    const prefix = result.severity === "error" ? "ERROR" : "WARN";
    console.log(`[${prefix}] ${result.message}`);
  }
}

function checkEnvironment(): CheckResult[] {
  const results: CheckResult[] = [];

  const databaseUrl = getEnv("DATABASE_URL");
  const authSecret = getEnv("NEXTAUTH_SECRET") ?? getEnv("AUTH_SECRET");
  const authUrl = getEnv("NEXTAUTH_URL") ?? getEnv("AUTH_URL");
  const googleClientId = getEnv("AUTH_GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("AUTH_GOOGLE_CLIENT_SECRET");

  const devLoginServer = getBooleanEnv("AUTH_ENABLE_DEV_LOGIN");
  const devLoginClient = getBooleanEnv("NEXT_PUBLIC_ENABLE_DEV_LOGIN");
  const roleOverrideServer = getBooleanEnv("AUTH_ALLOW_DEV_ROLE_OVERRIDE");
  const roleOverrideClient = getBooleanEnv("NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE");

  if (!databaseUrl) {
    results.push({
      severity: "error",
      message: "Falta DATABASE_URL.",
    });
  }

  if (!authSecret) {
    results.push({
      severity: "error",
      message: "Falta NEXTAUTH_SECRET o AUTH_SECRET.",
    });
  } else if (authSecret.length < 32) {
    results.push({
      severity: "warning",
      message: "AUTH secret corto (<32 caracteres). Se recomienda uno mas largo.",
    });
  }

  if (!authUrl) {
    results.push({
      severity: "error",
      message: "Falta NEXTAUTH_URL o AUTH_URL.",
    });
  } else if (!isValidAbsoluteUrl(authUrl)) {
    results.push({
      severity: "error",
      message: "NEXTAUTH_URL/AUTH_URL no es una URL absoluta valida.",
    });
  } else if (!authUrl.startsWith("https://")) {
    results.push({
      severity: "warning",
      message: "NEXTAUTH_URL/AUTH_URL no usa https:// (esperado en produccion).",
    });
  }

  const googleConfigured = Boolean(googleClientId && googleClientSecret);
  const devLoginEnabled = devLoginServer === true || devLoginClient === true;

  if (!googleConfigured && !devLoginEnabled) {
    results.push({
      severity: "error",
      message:
        "No hay provider de autenticacion habilitado. Configura Google o habilita AUTH_ENABLE_DEV_LOGIN.",
    });
  }

  if (googleClientId && !googleClientSecret) {
    results.push({
      severity: "error",
      message: "AUTH_GOOGLE_CLIENT_ID definido sin AUTH_GOOGLE_CLIENT_SECRET.",
    });
  }

  if (!googleClientId && googleClientSecret) {
    results.push({
      severity: "error",
      message: "AUTH_GOOGLE_CLIENT_SECRET definido sin AUTH_GOOGLE_CLIENT_ID.",
    });
  }

  if (
    devLoginServer !== undefined &&
    devLoginClient !== undefined &&
    devLoginServer !== devLoginClient
  ) {
    results.push({
      severity: "error",
      message:
        "AUTH_ENABLE_DEV_LOGIN y NEXT_PUBLIC_ENABLE_DEV_LOGIN tienen valores distintos.",
    });
  }

  if (
    roleOverrideServer !== undefined &&
    roleOverrideClient !== undefined &&
    roleOverrideServer !== roleOverrideClient
  ) {
    results.push({
      severity: "error",
      message:
        "AUTH_ALLOW_DEV_ROLE_OVERRIDE y NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE tienen valores distintos.",
    });
  }

  if (devLoginEnabled) {
    const allowlist = getEnv("AUTH_DEV_LOGIN_EMAIL_ALLOWLIST");
    const allowlistCount = (allowlist ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean).length;

    if (allowlistCount === 0) {
      results.push({
        severity: "error",
        message:
          "Dev-login habilitado sin AUTH_DEV_LOGIN_EMAIL_ALLOWLIST. Define al menos un email.",
      });
    }

    if (roleOverrideServer === true || roleOverrideClient === true) {
      results.push({
        severity: "error",
        message:
          "Dev-login habilitado con role override activo. Desactiva AUTH_ALLOW_DEV_ROLE_OVERRIDE y NEXT_PUBLIC_ALLOW_DEV_ROLE_OVERRIDE.",
      });
    }

    results.push({
      severity: "warning",
      message:
        "Dev-login esta habilitado. Se recomienda usar Google OAuth para produccion.",
    });
  }

  return results;
}

function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const results = checkEnvironment();
  printResults(results);

  const hasErrors = results.some((result) => result.severity === "error");
  if (hasErrors) {
    console.error("\ncheck-prod-env: FAIL");
    process.exit(1);
  }

  console.log("\ncheck-prod-env: OK");
}

main();
