# Jungle Game Leaderboard API

Thin Fastify + PostgreSQL backend for global leaderboard submissions.

## Folder Structure

```text
backend/
  .env.example
  package.json
  README.md
  migrations/
    001_init.sql
  src/
    index.js
    config.js
    db.js
    auth.js
    schemas.js
    antiCheat.js
    playerRateLimit.js
    routes/
      session.js
      leaderboard.js
```

## 1) Requirements

- Node.js 18+
- PostgreSQL 13+

## 2) Setup (Local)

1. Create database:
   - `createdb jungle_game`
2. Install deps:
   - `cd backend && npm install`
3. Configure env:
   - copy `.env.example` to `.env`
   - set `DATABASE_URL` and `SESSION_SIGNING_SECRET`
4. Run migrations (no psql required):
   - `npm run migrate`
5. Run API:
   - `npm run dev`

Server defaults to `http://localhost:8787`.

## 3) API Endpoints

### POST `/session/start`

Creates/updates player profile and returns signed session token.

Request body:

```json
{
  "playerId": "jg-player-abc12345",
  "displayName": "Banana CEO",
  "clientVersion": "1.0.5"
}
```

Response:

```json
{
  "token": "jwt...",
  "sessionId": "uuid",
  "tokenType": "Bearer",
  "expiresInSeconds": 86400,
  "serverTime": "2026-03-06T12:00:00.000Z"
}
```

### POST `/leaderboard/submit`

Requires `Authorization: Bearer <token>`.

Request body:

```json
{
  "playerId": "jg-player-abc12345",
  "sessionId": "uuid",
  "prestigeCount": 7,
  "pip": "1234",
  "totalBananasEarned": "9050000",
  "clientVersion": "1.0.5"
}
```

Response:

```json
{
  "accepted": true,
  "updatedAt": "2026-03-06T12:01:00.000Z"
}
```

### GET `/leaderboard?limit=25`

Returns top `N` sorted by:
1. `prestige_count DESC`
2. `pip DESC`
3. `total_bananas_earned DESC`
4. `updated_at ASC`

## 4) Security + Anti-Cheat

- Strict schema validation with Zod (`.strict()`).
- Session token required for submissions.
- Player/session in token must match submitted body.
- Global IP rate limit (`@fastify/rate-limit`).
- Per-player submission rate limit (in-memory minute buckets).
- Delta checks:
  - no negative values
  - no prestige decrease
  - no total bananas decrease
  - capped max values
  - reject unrealistic jumps in short windows
- Server trusts server time only.

## 5) cURL Smoke Test

Start session:

```bash
curl -X POST http://localhost:8787/session/start \
  -H "Content-Type: application/json" \
  -d '{"playerId":"jg-player-abc12345","displayName":"Banana CEO","clientVersion":"1.0.5"}'
```

Submit leaderboard update:

```bash
curl -X POST http://localhost:8787/leaderboard/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"playerId":"jg-player-abc12345","sessionId":"<SESSION_ID>","prestigeCount":2,"pip":"25","totalBananasEarned":"15000","clientVersion":"1.0.5"}'
```

Fetch leaderboard:

```bash
curl "http://localhost:8787/leaderboard?limit=25"
```

## 6) Deploy Notes

### Render

1. New Web Service from repo.
2. Root directory: `backend`.
3. Build: `npm install`.
4. Start: `npm start`.
5. Add env vars from `.env.example`.
6. Use managed Postgres and set `DATABASE_URL`.
7. Optional: if you disable `AUTO_MIGRATE_ON_START`, run `npm run migrate` during deploy.

### No SQL Tooling Flow

If pgAdmin/PgHero/psql is unavailable, you can still migrate with app code:

```bash
cd backend
npm run migrate
```

Or rely on startup auto-migrations (`AUTO_MIGRATE_ON_START=true`), which is enabled by default.

### Railway

1. New project -> deploy from repo.
2. Set service root to `backend`.
3. Add PostgreSQL plugin.
4. Set env vars (`DATABASE_URL`, `SESSION_SIGNING_SECRET`, etc).
5. Run migration SQL in Railway DB console.

### Fly.io

1. `cd backend`
2. `fly launch` (Node app).
3. `fly postgres create` and attach.
4. `fly secrets set SESSION_SIGNING_SECRET=...`.
5. Run migration using `fly ssh console` + `psql`.

## 7) Privacy

- No email/password.
- No IP exposure in API responses.
- Only stores playerId, display name, leaderboard stats, and optional submit logs.
