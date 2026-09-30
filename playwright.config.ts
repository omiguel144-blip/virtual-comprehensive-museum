import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// Use a preinstalled Chromium when available (e.g. cloud sandboxes); otherwise run `npx playwright install chromium`.
const chromium = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const port = 3107;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: `http://localhost:${port}`,
    launchOptions: fs.existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: `npx tsx e2e/fixture.ts && npx next dev -p ${port}`,
    url: `http://localhost:${port}`,
    env: { DATABASE_PATH: "data/e2e.db" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
