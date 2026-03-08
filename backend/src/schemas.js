import { z } from "zod";

const playerIdRegex = /^[a-zA-Z0-9_-]{8,80}$/;
const sessionIdRegex = /^[a-zA-Z0-9-]{8,80}$/;

const nonNegativeInt = z.number().int().nonnegative();
const nonNegativeBigIntLike = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]);
const nonNegativeNumericLike = z.union([z.number().nonnegative(), z.string().regex(/^\d+(\.\d+)?$/)]);

export const sessionStartSchema = z
  .object({
    playerId: z.string().regex(playerIdRegex),
    displayName: z
      .string()
      .trim()
      .min(3)
      .max(16)
      .regex(/^[^<>"'`]+$/, "displayName contains invalid characters"),
    clientVersion: z.string().trim().min(1).max(64).default("unknown"),
  })
  .strict();

export const leaderboardSubmitSchema = z
  .object({
    playerId: z.string().regex(playerIdRegex),
    sessionId: z.string().regex(sessionIdRegex),
    prestigeCount: nonNegativeInt.max(1_000_000),
    pip: nonNegativeBigIntLike,
    totalBananasEarned: nonNegativeNumericLike,
    clientVersion: z.string().trim().min(1).max(64).default("unknown"),
  })
  .strict();

export const leaderboardQuerySchema = z
  .object({
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 25))
      .pipe(z.number().int().min(1).max(100)),
  })
  .strict();

export function parsePip(value) {
  if (typeof value === "number") {
    return BigInt(Math.floor(value));
  }
  return BigInt(value);
}

export function parseTotalBananas(value) {
  if (typeof value === "number") {
    return value;
  }
  return Number(value);
}
