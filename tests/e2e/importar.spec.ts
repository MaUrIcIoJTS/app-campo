import { expect, test, type Page } from '@playwright/test';

const FIXTURE = 'tests/fixtures/pcm-ficticio.xls';
const linhas = (page: Page) => page.locator('.lista-eq > li');

async function esperarServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 })
    .toBe(true);
}

async function importarFixture(page: Page) {
  await page.getByRole('link', { name: 'Importar PCM' }).first().click();
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByRole('heading', { name: 'pcm-ficticio.xls' })).toBeVisible();
  await page.getByRole('button', { name: 'Importar 9 equipamentos' }).click();
  await expect(page.getByText('9 equipamentos', { exact: true })).toBeVisible();
}

test('importa o PCM, lista, busca e filtra por aba', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  await expect(page.getByText('PCM importado: 9 equipamentos.')).toBeVisible();
  await expect(linhas(page)).toHaveCount(9);

  const busca = page.getByRole('searchbox', { name: /Buscar equipamento/ });
  await busca.fill('tc02');
  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText('XA-TC-02');
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(linhas(page)).toHaveCount(9);

  await page
    .getByRole('combobox', { name: 'Filtrar por aba' })
    .selectOption('SECAGEM E CLASSIFICAÇÃO');
  await expect(linhas(page)).toHaveCount(4);
  await expect(page.getByText('4 de 9 equipamentos')).toBeVisible();
});

test('em modo avião: importa, recarrega, fecha e reabre — tudo continua lá', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await page.reload();

  await importarFixture(page); // o chunk do SheetJS tem que vir do cache
  await page.reload();
  await expect(linhas(page)).toHaveCount(9);

  await page.close(); // "fechar o app"
  const reaberta = await context.newPage();
  await reaberta.goto('./');
  await expect(linhas(reaberta)).toHaveCount(9);
  await expect(reaberta.getByText('PCM: pcm-ficticio.xls')).toBeVisible();
});

test('ficha mostra itens do PCM e tambores deduzidos; voltar mantém a busca', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  await page.getByRole('searchbox', { name: /Buscar equipamento/ }).fill('XA-TC-01');
  await linhas(page).first().click();

  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TAPETE' })).toBeVisible();
  await expect(page.getByText('26" 3/16 X 1/16 2 LONAS')).toBeVisible();
  await expect(page.getByText('Não está no PCM — deduzido dos mancais')).toHaveCount(2);

  await page.getByRole('link', { name: /Lista/ }).click();
  await expect(page.getByRole('searchbox', { name: /Buscar equipamento/ })).toHaveValue('XA-TC-01');
  await expect(linhas(page)).toHaveCount(1);
});

test('arquivo que não é PCM mostra erro claro e deixa tentar de novo', async ({ page }) => {
  await page.goto('./#/importar');
  await page.locator('input[type=file]').setInputFiles({
    name: 'foto.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('isto não é uma planilha'),
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('label', { hasText: 'Escolher outro arquivo' })).toBeVisible();
});

test('lista e ficha cabem em 360 px sem rolagem horizontal', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  const largura = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await largura()).toBeLessThanOrEqual(360);
  await linhas(page).nth(4).click(); // elevador, nome longo
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await largura()).toBeLessThanOrEqual(360);
});
