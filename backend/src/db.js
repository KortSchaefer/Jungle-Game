import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

const pool = new Pool(
  config.databaseUrl
    ? {
        connectionString: config.databaseUrl,
        ssl: config.pgssl ? { rejectUnauthorized: false } : false,
      }
    : {
        ssl: config.pgssl ? { rejectUnauthorized: false } : false,
      }
);

export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function withTransaction(workFn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await workFn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  await pool.end();
}
