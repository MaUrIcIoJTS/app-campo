import { expect, type Page } from '@playwright/test';

export const FIXTURE = 'tests/fixtures/pcm-ficticio.xls';

export const linhas = (page: Page) => page.locator('.lista-eq > li');

/** Cartão de um item na ficha, pelo nome exato do item. */
export const cartao = (page: Page, item: string) =>
  page.locator('li.item').filter({ has: page.getByRole('heading', { name: item, exact: true }) });

/** Espera o service worker pré-carregar o app e assumir a página (a partir daí, abre offline). */
export async function esperarServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 })
    .toBe(true);
}

export async function importarFixture(page: Page) {
  await page.getByRole('link', { name: 'Importar PCM' }).first().click();
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByRole('heading', { name: 'pcm-ficticio.xls' })).toBeVisible();
  await page.getByRole('button', { name: 'Importar (9 equipamentos)' }).click();
  await expect(page.getByText('9 equipamentos', { exact: true })).toBeVisible();
}

export async function abrirFicha(page: Page, tag: string) {
  await linhas(page).filter({ hasText: tag }).click();
  await expect(page.getByRole('heading', { level: 1, name: tag })).toBeVisible();
}
