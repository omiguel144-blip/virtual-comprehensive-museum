import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "museum.db");
}

export function openDb(file = databasePath()) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export type Db = ReturnType<typeof openDb>;

const globalForDb = globalThis as unknown as { museumDb?: Db };

export function getDb(): Db {
  globalForDb.museumDb ??= openDb();
  return globalForDb.museumDb;
}
