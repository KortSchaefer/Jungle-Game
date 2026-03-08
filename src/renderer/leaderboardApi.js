function toBaseUrl(rawBaseUrl) {
  return String(rawBaseUrl || "").trim().replace(/\/+$/, "");
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function startLeaderboardSession({ baseUrl, playerId, displayName, clientVersion }) {
  const normalizedBaseUrl = toBaseUrl(baseUrl);
  const response = await fetch(`${normalizedBaseUrl}/session/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      playerId,
      displayName,
      clientVersion,
    }),
  });
  return parseJsonResponse(response);
}

export async function submitLeaderboardStats({
  baseUrl,
  token,
  playerId,
  sessionId,
  prestigeCount,
  pip,
  totalBananasEarned,
  clientVersion,
}) {
  const normalizedBaseUrl = toBaseUrl(baseUrl);
  const response = await fetch(`${normalizedBaseUrl}/leaderboard/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      playerId,
      sessionId,
      prestigeCount,
      pip: String(pip),
      totalBananasEarned: String(Math.floor(Number(totalBananasEarned) || 0)),
      clientVersion,
    }),
  });
  return parseJsonResponse(response);
}

export async function fetchLeaderboard({ baseUrl, limit = 25 }) {
  const normalizedBaseUrl = toBaseUrl(baseUrl);
  const response = await fetch(`${normalizedBaseUrl}/leaderboard?limit=${encodeURIComponent(limit)}`);
  return parseJsonResponse(response);
}

export async function fetchLeaderboardMe({ baseUrl, token }) {
  const normalizedBaseUrl = toBaseUrl(baseUrl);
  const response = await fetch(`${normalizedBaseUrl}/leaderboard/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse(response);
}
