import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.playwright.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  // Démarre le backend Express automatiquement (réutilise un serveur existant).
  // 2 serveurs : 3000 (sans auth, tests généraux) et 3100 (AUTH_SECRET actif,
  // flux de connexion — testé par auth.playwright.ts).
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command:
        "PORT=3100 AUTH_SECRET=test-secret-e2e-32-chars-min ADMIN_TOKEN=admin-token-e2e WS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100,tauri://localhost,http://tauri.localhost,https://tauri.localhost npm run dev",
      url: "http://localhost:3100/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Les tests auth exigent le serveur avec AUTH_SECRET (project "auth")
      testIgnore: "**/auth.playwright.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Project avec authentification ACTIVÉE (serveur dédié, port 3100) :
      // teste le flux login + les vues qui exigent une session.
      name: "auth",
      testMatch: "**/auth.playwright.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3100" },
    },
  ],
});
