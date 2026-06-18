import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) return configured;
  return path.join(process.cwd(), "data", "pantry.db");
}

/**
 * Returns a singleton SQLite connection, creating the data directory and
 * schema on first use. Synchronous by design (better-sqlite3).
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode         TEXT,
      name            TEXT NOT NULL,
      brand           TEXT,
      category        TEXT,
      quantity        REAL NOT NULL DEFAULT 1,
      unit            TEXT NOT NULL DEFAULT 'each',
      location        TEXT,
      expiration_date TEXT,
      image_url       TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_items_barcode  ON items(barcode);
    CREATE INDEX IF NOT EXISTS idx_items_name     ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);
  `);

  migrate(db);
  return db;
}

// Lightweight, additive migrations. CREATE TABLE IF NOT EXISTS can't add
// columns to an existing table, so new columns are added here idempotently.
function migrate(conn: Database.Database) {
  const cols = conn.prepare("PRAGMA table_info(items)").all() as { name: string }[];
  const has = (name: string) => cols.some((c) => c.name === name);

  // `needed` drives the shopping list ("need more" flag).
  if (!has("needed")) {
    conn.exec("ALTER TABLE items ADD COLUMN needed INTEGER NOT NULL DEFAULT 0");
  }
}
