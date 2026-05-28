import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT ?? "5174";
const E2E_API_PORT = process.env.E2E_API_PORT ?? "3099";
const baseURL = `http://localhost:${E2E_PORT}`;

const chromiumExecutable = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  reporter: "line",
  use: {
    baseURL,
    headless: true,
    ...(chromiumExecutable ? { launchOptions: { executablePath: chromiumExecutable } } : {}),
  },
  webServer: [
    {
      command: `PORT=${E2E_API_PORT} pnpm --filter @workspace/api-server exec tsx src/index.ts`,
      port: Number(E2E_API_PORT),
      timeout: 30_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `PORT=${E2E_PORT} BASE_PATH=/ E2E_API_PORT=${E2E_API_PORT} pnpm --filter @workspace/address-validator run dev`,
      url: baseURL,
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
