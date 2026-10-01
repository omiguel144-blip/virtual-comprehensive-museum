import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrationCount } from "./index";

describe("migrationCount", () => {
  it("counts the migrations in the repo's journal", () => {
    const journal = JSON.parse(fs.readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"));
    expect(migrationCount()).toBe(journal.entries.length);
    expect(migrationCount()).toBeGreaterThanOrEqual(2);
  });

  it("returns 0 when there is no journal", () => {
    expect(migrationCount(fs.mkdtempSync(path.join(os.tmpdir(), "nomig-")))).toBe(0);
  });
});
