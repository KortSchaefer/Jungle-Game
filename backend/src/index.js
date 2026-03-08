import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { closeDb, query } from "./db.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { sessionRoutes } from "./routes/session.js";

const app = Fastify({
  logger: {
    level: config.nodeEnv === "production" ? "info" : "debug",
  },
});

app.decorate("config", {
  sessionTokenTtlSeconds: config.sessionTokenTtlSeconds,
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "request_failed");
  if (reply.sent) {
    return;
  }
  reply.code(500).send({
    error: "internal_server_error",
  });
});

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  methods: ["GET", "POST", "OPTIONS"],
});

await app.register(rateLimit, {
  global: true,
  max: config.globalRateLimitMaxPerMinute,
  timeWindow: "1 minute",
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    error: "ip_rate_limit",
  }),
});

app.get("/health", async () => {
  const dbPing = await query("SELECT 1 AS ok");
  return {
    ok: true,
    db: dbPing.rows[0]?.ok === 1,
    now: new Date().toISOString(),
  };
});

await app.register(sessionRoutes);
await app.register(leaderboardRoutes);

const closeSignals = ["SIGINT", "SIGTERM"];
closeSignals.forEach((signal) => {
  process.on(signal, async () => {
    try {
      await app.close();
      await closeDb();
    } finally {
      process.exit(0);
    }
  });
});

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });
  app.log.info(`Leaderboard API running on http://${config.host}:${config.port}`);
} catch (error) {
  app.log.error(error, "failed_to_start_server");
  await closeDb();
  process.exit(1);
}
