import { defineConfig, devices } from '@playwright/test'

// 沒有設定 locale 時，Chromium 會把非 ASCII 的下載檔名換成 "download"。
if (!process.env.LANG) process.env.LANG = 'C.UTF-8'

export default defineConfig({
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  testDir: 'e2e',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/pdf-tool/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173/pdf-tool/' },
})
