import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const configDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDir, "../.env") });

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 8787),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL || "",
  pgssl: toBoolean(process.env.PGSSL, false),
  sessionSigningSecret: process.env.SESSION_SIGNING_SECRET || "",
  sessionTokenTtlSeconds: toNumber(process.env.SESSION_TOKEN_TTL_SECONDS, 86400),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  globalRateLimitMaxPerMinute: toNumber(process.env.RATE_LIMIT_MAX_PER_MINUTE, 120),
  submitRateLimitPerPlayerPerMinute: toNumber(process.env.SUBMIT_RATE_LIMIT_PER_PLAYER_PER_MINUTE, 20),
};

if (!config.sessionSigningSecret || config.sessionSigningSecret.length < 24) {
  throw new Error("SESSION_SIGNING_SECRET must be set and at least 24 characters.");
}
