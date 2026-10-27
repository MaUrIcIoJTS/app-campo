import { expect, test } from '@playwright/test';
import {
  abrirFicha,
  cartao,
  esperarServiceWorker,
  importarFixture,
  linhas,
  noItem,
} from './apoio.ts';

test('croqui do aeroseparador: a letra leva ao campo; ≈, perímetro, sem acesso e não tem; reabre offline com tudo', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await importarFixture(page);
  await abrirFicha(page, 'XB-AS-01');

  // A ficha abre na guia Exterior, com o croqui aberto no alto.
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/^Exterior/);
  await expect(page.getByRole('img', { name: 'Aeroseparador: cotas A a F' })).toBeVisible();
  const croqui = cartao(page, 'MEDIDAS EXTERNAS');
  await expect(croqui.getByText('Não está no PCM — medidas do corpo')).toBeVisible();

  // Tocar na letra C leva ao campo C; o "≈" entra no texto e a letra fica cheia.
  await page.getByRole('button', { name: 'Cota C: falta medir' }).click();
  const cone = croqui.getByRole('textbox', { name: /^Altura do cone/ });
  await expect(cone).toBeFocused();
  await page.keyboard.type('1800');
  await croqui.getByRole('button', { name: 'Altura do cone: estimado' }).click();
  await expect(cone).toHaveValue('≈ 1800');
  await expect(page.getByRole('button', { name: 'Cota C: medida' })).toBeVisible();

  // A: o Ø pelo perímetro (trena em volta).
  await croqui.getByRole('button', { name: 'Medi o perímetro' }).click();
  await croqui.getByRole('textbox', { name: /^Perímetro/ }).fill('6000');
  await expect(croqui.getByText('1910 mm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cota A: medida' })).toBeVisible();

  // F sem acesso, E não tem: letras cinza. B digitado.
  await croqui.getByRole('button', { name: 'Alimentação (em cima): sem acesso' }).click();
  await croqui.getByRole('button', { name: 'Ø do retorno de grossos: não tem' }).click();
  await expect(page.getByRole('button', { name: 'Cota F: sem medida' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cota E: sem medida' })).toBeVisible();
  await croqui.getByRole('textbox', { name: /^Altura do cilindro/ }).fill('2400');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.close(); // "fechar à força", sem esperar o "Salvo no aparelho"

  const reaberta = await context.newPage();
  await reaberta.goto('./');
  await expect(linhas(reaberta)).toHaveCount(15);
  await abrirFicha(reaberta, 'XB-AS-01');
  const depois = cartao(reaberta, 'MEDIDAS EXTERNAS');
  await expect(depois.getByRole('textbox', { name: /^Altura do cone/ })).toHaveValue('≈ 1800');
  await expect(depois.getByRole('textbox', { name: /^Perímetro/ })).toHaveValue('6000');
  await expect(depois.getByRole('textbox', { name: /^Altura do cilindro/ })).toHaveValue('2400');
  await expect(
    depois.getByRole('button', { name: 'Alimentação (em cima): sem acesso' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    depois.getByRole('button', { name: 'Ø do retorno de grossos: não tem' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(reaberta.getByRole('button', { name: 'Cota D: falta medir' })).toBeVisible();
  await expect(depois.getByText('5/6')).toBeVisible();
});

test('PCM importado por uma versão sem croqui: ao abrir o app, os croquis aparecem sem trocar o PCM', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await importarFixture(page);
  await abrirFicha(page, 'XB-AS-01');
  const motor = await noItem(page, 'MOTOR');
  await motor.getByRole('textbox', { name: 'Potência' }).fill('7,5');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();

  // O banco como a versão anterior deixou: sem os itens "MEDIDAS EXTERNAS".
  const apagados = await page.evaluate(
    () =>
      new Promise<number>((ok, falha) => {
        const req = indexedDB.open('levantamento-pcm');
        req.onerror = () => falha(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction('itens', 'readwrite');
          const store = tx.objectStore('itens');
          let n = 0;
          store.openCursor().onsuccess = (e) => {
            const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (!c) return;
            if ((c.value as { nome: string }).nome === 'MEDIDAS EXTERNAS') {
              c.delete();
              n++;
            }
            c.continue();
          };
          tx.oncomplete = () => {
            req.result.close();
            ok(n);
          };
          tx.onerror = () => falha(tx.error);
        };
      }),
  );
  expect(apagados).toBe(9);

  const reaberta = await context.newPage();
  await page.close();
  await reaberta.goto('./');
  await expect(linhas(reaberta)).toHaveCount(15);
  await abrirFicha(reaberta, 'XB-AS-01');
  await expect(reaberta.getByRole('tab', { selected: true })).toHaveText(/^Exterior/);
  await expect(reaberta.getByRole('img', { name: 'Aeroseparador: cotas A a F' })).toBeVisible();
  await expect(
    (await noItem(reaberta, 'MOTOR')).getByRole('textbox', { name: 'Potência' }),
  ).toHaveValue('7,5');
});
