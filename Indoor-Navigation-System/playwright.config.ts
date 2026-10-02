// End-to-end tests: the built app served by the backend's demo server (template site, in-memory
// data, no Firebase), driven in a phone-sized Chromium with a simulated compass.
//   npm run build && npm run test:e2e
import { defineConfig, devices } from "@playwright/test";

const PORT = 3105;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"],
    baseURL: `http://localhost:${PORT}`,
    permissions: ["camera"],
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  },
  webServer: {
    command: "npm run demo",
    cwd: "../backend",
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/sites/_template`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
