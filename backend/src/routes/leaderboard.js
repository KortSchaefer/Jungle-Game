import { authPreHandler } from "../auth.js";
import { validateSubmissionDelta } from "../antiCheat.js";
import { query, withTransaction } from "../db.js";
import { checkPlayerSubmitRateLimit, prunePlayerRateLimitBuckets } from "../playerRateLimit.js";
import {
  leaderboardQuerySchema,
  leaderboardSubmitSchema,
  parsePip,
  parseTotalBananas,
} from "../schemas.js";

async function logSubmission(playerId, sessionId, accepted, reason) {
  try {
    await query(
      `INSERT INTO submission_log (player_id, session_id, accepted, reason)
       VALUES ($1, $2, $3, $4)`,
      [playerId, sessionId, accepted, reason]
    );
  } catch (_error) {
    // Optional telemetry table should never break leaderboard flow.
  }
}

export async function leaderboardRoutes(fastify) {
  fastify.get("/leaderboard", async (request, reply) => {
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_query", details: parsed.error.flatten() });
    }

    const { limit } = parsed.data;
    const result = await query(
      `SELECT p.id, p.display_name, l.prestige_count, l.pip, l.total_bananas_earned, l.updated_at
       FROM leaderboard_stats l
       JOIN players p ON p.id = l.player_id
       ORDER BY l.prestige_count DESC, l.pip DESC, l.total_bananas_earned DESC, l.updated_at ASC
       LIMIT $1`,
      [limit]
    );

    const entries = result.rows.map((row, idx) => ({
      rank: idx + 1,
      playerId: row.id,
      displayName: row.display_name,
      prestigeCount: Number(row.prestige_count),
      pip: String(row.pip),
      totalBananasEarned: String(row.total_bananas_earned),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    return reply.send({
      entries,
      lastUpdatedAt: new Date().toISOString(),
    });
  });

  fastify.post("/leaderboard/submit", { preHandler: authPreHandler }, async (request, reply) => {
    prunePlayerRateLimitBuckets();

    const parsed = leaderboardSubmitSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request_body", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    if (request.session.playerId !== data.playerId) {
      await logSubmission(data.playerId, data.sessionId, false, "player_id_mismatch");
      return reply.code(401).send({ error: "player_id_mismatch" });
    }
    if (request.session.sessionId !== data.sessionId) {
      await logSubmission(data.playerId, data.sessionId, false, "session_id_mismatch");
      return reply.code(401).send({ error: "session_id_mismatch" });
    }

    if (!checkPlayerSubmitRateLimit(data.playerId)) {
      await logSubmission(data.playerId, data.sessionId, false, "player_rate_limit");
      return reply.code(429).send({ error: "player_rate_limit" });
    }

    const pip = parsePip(data.pip);
    const totalBananasEarned = parseTotalBananas(data.totalBananasEarned);
    if (!Number.isFinite(totalBananasEarned) || totalBananasEarned < 0) {
      await logSubmission(data.playerId, data.sessionId, false, "invalid_total_bananas");
      return reply.code(400).send({ error: "invalid_total_bananas" });
    }

    const now = new Date();
    const current = await query(
      `SELECT player_id, prestige_count, pip, total_bananas_earned, updated_at
       FROM leaderboard_stats
       WHERE player_id = $1`,
      [data.playerId]
    );
    const previous = current.rows[0] || null;

    const antiCheatResult = validateSubmissionDelta({
      incomingPrestigeCount: data.prestigeCount,
      incomingPip: pip,
      incomingTotalBananas: totalBananasEarned,
      previousStats: previous,
      now,
    });
    if (!antiCheatResult.ok) {
      await logSubmission(data.playerId, data.sessionId, false, antiCheatResult.reason);
      return reply.code(400).send({ error: "submission_rejected", reason: antiCheatResult.reason });
    }

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO players (id, display_name, created_at, last_seen_at)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (id)
         DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at`,
        [data.playerId, "Banana CEO", now]
      );

      await client.query(
        `INSERT INTO leaderboard_stats (
           player_id, prestige_count, pip, total_bananas_earned, updated_at, client_version, last_session_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (player_id)
         DO UPDATE SET
           prestige_count = EXCLUDED.prestige_count,
           pip = EXCLUDED.pip,
           total_bananas_earned = EXCLUDED.total_bananas_earned,
           updated_at = EXCLUDED.updated_at,
           client_version = EXCLUDED.client_version,
           last_session_id = EXCLUDED.last_session_id`,
        [data.playerId, data.prestigeCount, pip.toString(), Math.floor(totalBananasEarned), now, data.clientVersion, data.sessionId]
      );
    });

    await logSubmission(data.playerId, data.sessionId, true, "accepted");

    return reply.send({
      accepted: true,
      updatedAt: now.toISOString(),
    });
  });
}
