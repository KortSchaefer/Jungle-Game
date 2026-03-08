import { closeDb } from "./db.js";
import { runMigrations } from "./migrate.js";

try {
  await runMigrations(console);
  await closeDb();
  process.exit(0);
} catch (error) {
  console.error("Migration failed.", error);
  await closeDb();
  process.exit(1);
}
