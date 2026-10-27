import { expect, test } from '@playwright/test';
import { abrirGuia, esperarServiceWorker, importarFixture, linhas } from './apoio.ts';

test('importa o PCM, lista, busca e filtra por aba', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  const aviso = page.getByText('PCM importado: 10 equipamentos.');
  await expect(aviso).toBeVisible();
  await expect(linhas(page)).toHaveCount(10);
  // O aviso fica no topo (logo abaixo da barra): não cobre os botões do fim da tela.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const caixa = (await aviso.boundingBox())!;
  expect(caixa.y).toBeLessThan(140);
  const tema = (await page.getByRole('button', { name: /^Tema:/ }).boundingBox())!;
  expect(caixa.y + caixa.height).toBeLessThan(tema.y);

  const busca = page.getByRole('searchbox', { name: /Buscar equipamento/ });
  await busca.fill('tc02');
  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText('XA-TC-02');
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await expect(linhas(page)).toHaveCount(10);

  await page
    .getByRole('combobox', { name: 'Filtrar por aba' })
    .selectOption('SECAGEM E CLASSIFICAÇÃO');
  await expect(linhas(page)).toHaveCount(5);
  await expect(page.getByText('5 de 10 equipamentos')).toBeVisible();
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
  await expect(linhas(page)).toHaveCount(10);

  await page.close(); // "fechar o app"
  const reaberta = await context.newPage();
  await reaberta.goto('./');
  await expect(linhas(reaberta)).toHaveCount(10);
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
  // Os tambores deduzidos ficam na guia Tambores (e também na guia PCM, como linhas extras).
  await abrirGuia(page, 'Tambores');
  await expect(page.getByText('Não está no PCM — deduzido dos mancais')).toHaveCount(2);
  await abrirGuia(page, 'PCM');
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
  await expect(page.locator('label', { hasText: 'Escolher arquivo de novo' })).toBeVisible();
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

test('TAG nunca quebra no hífen, mesmo com nome de aba longo', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  const linhasDeTexto = await page
    .locator('.eq-tag:not(.eq-tag--nome)')
    .evaluateAll((els) => els.map((e) => e.getClientRects().length));
  expect(linhasDeTexto.length).toBeGreaterThan(0);
  expect(linhasDeTexto.every((n) => n === 1)).toBe(true);
});

test('"‹ Lista" volta sem empilhar histórico (o voltar do Android não reabre a ficha)', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await linhas(page).nth(2).click();
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
  const naFicha = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: /Lista/ }).click();
  await expect(linhas(page)).toHaveCount(10);
  expect(await page.evaluate(() => history.length)).toBe(naFicha); // nada empilhado
  await page.goForward(); // usou history.back(): a ficha ficou "à frente"
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
});
