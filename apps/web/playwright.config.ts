import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3101", locale: "es", permissions: ["clipboard-write"] },
  webServer: {
    command: "pnpm build && pnpm start --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
