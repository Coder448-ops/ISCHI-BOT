import { defineConfig } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The browser and its Linux compatibility libraries come through npm; no CDN is needed.
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  execFileSync(
    process.execPath,
    [
      '-e',
      "const c=require('@sparticuz/chromium'); Promise.all([c.default.executablePath(),c.inflate('node_modules/@sparticuz/chromium/bin/al2023.tar.br')]).then(()=>process.stdout.write('/tmp/chromium'))",
    ],
    { encoding: 'utf8' },
  );
process.env.LD_LIBRARY_PATH = [join(tmpdir(), 'al2023', 'lib'), process.env.LD_LIBRARY_PATH]
  .filter(Boolean)
  .join(':');
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: {
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      "node -e \"for(const s of ['', '-wal', '-shm']) require('fs').rmSync('.data/e2e.sqlite'+s,{force:true})\" && npx next start --hostname 0.0.0.0 --port 3001",
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_PATH: '.data/e2e.sqlite',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'e2e-only-admin-password-2026',
      TELEGRAM_BOT_TOKEN: '',
      TELEGRAM_CHAT_ID: '@Navroz0909',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
