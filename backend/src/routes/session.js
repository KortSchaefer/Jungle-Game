import crypto from "node:crypto";
import { signSessionToken } from "../auth.js";
import { query } from "../db.js";
import { sessionStartSchema } from "../schemas.js";

export async function sessionRoutes(fastify) {
  fastify.post("/session/start", async (request, reply) => {
    const parsed = sessionStartSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request_body",
        details: parsed.error.flatten(),
      });
    }

    const { playerId, displayName } = parsed.data;
    const now = new Date();
    const sessionId = crypto.randomUUID();

    await query(
      `INSERT INTO players (id, display_name, created_at, last_seen_at)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (id)
       DO UPDATE SET display_name = EXCLUDED.display_name, last_seen_at = EXCLUDED.last_seen_at`,
      [playerId, displayName, now]
    );

    const token = signSessionToken({ playerId, sessionId });
    return reply.send({
      token,
      sessionId,
      tokenType: "Bearer",
      expiresInSeconds: fastify.config.sessionTokenTtlSeconds,
      serverTime: now.toISOString(),
    });
  });
}
