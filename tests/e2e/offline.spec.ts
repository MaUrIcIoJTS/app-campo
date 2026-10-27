import { expect, test } from '@playwright/test';
import { esperarServiceWorker } from './apoio.ts';

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

  test('rodapé mostra a versão; ao voltar ao app com internet, procura versão nova', async ({
    page,
    context,
  }) => {
    // Conta as procuras por versão nova e deixa o teste adiantar o relógio.
    await context.addInitScript(() => {
      const w = window as unknown as { procuras: number; adiantar: number };
      w.procuras = 0;
      w.adiantar = 0;
      const agora = Date.now;
      Date.now = () => agora() + w.adiantar;
      const update = ServiceWorkerRegistration.prototype.update;
      ServiceWorkerRegistration.prototype.update = function () {
        w.procuras++;
        return update.call(this);
      };
    });
    await page.goto('./');
    await esperarServiceWorker(page);
    await expect(page.getByText(/^Versão de \d\d\/\d\d · [0-9a-f]{7,}$/)).toBeVisible();

    const procuras = () =>
      page.evaluate(() => (window as unknown as { procuras: number }).procuras);
    const voltarAoApp = (ms: number) =>
      page.evaluate((ms) => {
        (window as unknown as { adiantar: number }).adiantar = ms;
        document.dispatchEvent(new Event('visibilitychange'));
      }, ms);
    const antes = await procuras();

    // Logo depois de abrir, o navegador já procurou: não repete.
    await voltarAoApp(0);
    expect(await procuras()).toBe(antes);
    // Voltou do segundo plano depois de um tempo: procura (uma vez só).
    await voltarAoApp(61_000);
    await voltarAoApp(62_000);
    expect(await procuras()).toBe(antes + 1);
    // Sem internet não procura; quando ela volta, procura.
    await context.setOffline(true);
    await voltarAoApp(130_000);
    expect(await procuras()).toBe(antes + 1);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    expect(await procuras()).toBe(antes + 2);
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
