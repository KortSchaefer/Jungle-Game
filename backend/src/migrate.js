import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, withTransaction } from "./db.js";

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentFileDir, "../migrations");

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrationIds() {
  const result = await query("SELECT id FROM schema_migrations");
  return new Set(result.rows.map((row) => String(row.id)));
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function applyMigrationFile(fileName) {
  const migrationPath = path.join(migrationsDir, fileName);
  const migrationSql = await fs.readFile(migrationPath, "utf8");

  await withTransaction(async (client) => {
    await client.query(migrationSql);
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [fileName]);
  });
}

export async function runMigrations(logger = console) {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrationIds();
  const files = await getMigrationFiles();
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    logger.info?.("No pending migrations.");
    return { appliedCount: 0, pendingCount: 0 };
  }

  for (const file of pending) {
    logger.info?.(`Applying migration ${file}...`);
    await applyMigrationFile(file);
  }

  logger.info?.(`Applied ${pending.length} migration(s).`);
  return { appliedCount: pending.length, pendingCount: 0 };
}
