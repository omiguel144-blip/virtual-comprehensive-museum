import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "museum.db");
}

const migrationsFolder = () => path.join(process.cwd(), "drizzle");

export function openDb(file = databasePath()) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

export type Db = ReturnType<typeof openDb>;

/** Number of migrations on disk; changes when a pull brings a new one. */
export function migrationCount(folder = migrationsFolder()): number {
  try {
    const journal = JSON.parse(fs.readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"));
    return Array.isArray(journal.entries) ? journal.entries.length : 0;
  } catch {
    return 0;
  }
}

const globalForDb = globalThis as unknown as { museumDb?: Db; museumDbMigrations?: number };

export function getDb(): Db {
  if (!globalForDb.museumDb) {
    globalForDb.museumDb = openDb();
    globalForDb.museumDbMigrations = migrationCount();
  } else if (process.env.NODE_ENV !== "production") {
    // A long-running dev server can hot-reload code that expects a newer
    // schema; apply any new migrations to the open connection.
    const count = migrationCount();
    if (count !== globalForDb.museumDbMigrations) {
      migrate(globalForDb.museumDb, { migrationsFolder: migrationsFolder() });
      globalForDb.museumDbMigrations = count;
    }
  }
  return globalForDb.museumDb;
}
