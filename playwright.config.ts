import { defineConfig, devices } from '@playwright/test';

const PORTA = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA}/`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    {
      // Celular Android típico de campo: 360 px de largura.
      name: 'android-360',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 360, height: 740 },
      },
    },
  ],
  // Testa sempre o build de produção (é ele que tem service worker).
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
