import { expect, test } from '@playwright/test';

test.describe('PWA offline', () => {
  test('depois do primeiro acesso, abre em modo avião', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Levantamento PCM' })).toBeVisible();

    // Espera o service worker terminar de pré-carregar o app e assumir a página.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByText('Pronto para usar offline')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Levantamento PCM' })).toBeVisible();
    await expect(page.getByText('Pronto para usar offline')).toBeVisible();
  });

  test('manifest permite instalar na tela inicial', async ({ page }) => {
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await page.request.get(new URL(href!, page.url()).href)).json();
    expect(manifest).toMatchObject({ lang: 'pt-BR', display: 'standalone' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    );
  });

  test('cabe em 360 px sem rolagem horizontal', async ({ page }) => {
    await page.goto('./');
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(360);
  });
});
