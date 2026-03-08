import jwt from "jsonwebtoken";
import { config } from "./config.js";

export function signSessionToken({ playerId, sessionId }) {
  return jwt.sign(
    {
      sub: playerId,
      sid: sessionId,
      typ: "session",
    },
    config.sessionSigningSecret,
    {
      algorithm: "HS256",
      expiresIn: config.sessionTokenTtlSeconds,
      issuer: "jungle-game-leaderboard-api",
      audience: "jungle-game-client",
    }
  );
}

export function verifySessionToken(token) {
  return jwt.verify(token, config.sessionSigningSecret, {
    algorithms: ["HS256"],
    issuer: "jungle-game-leaderboard-api",
    audience: "jungle-game-client",
  });
}

export function authPreHandler(request, reply, done) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : request.headers["x-session-token"];
  if (!token) {
    reply.code(401).send({ error: "missing_session_token" });
    return;
  }

  try {
    const payload = verifySessionToken(String(token));
    request.session = {
      playerId: String(payload.sub),
      sessionId: String(payload.sid),
    };
    done();
  } catch (_error) {
    reply.code(401).send({ error: "invalid_session_token" });
  }
}
