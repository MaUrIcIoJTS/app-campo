import { expect, test, type Page } from '@playwright/test';
import {
  abrirFicha,
  cartao,
  fichaOffline,
  fotosNoBanco,
  importarFixture,
  jpegDeCamera,
  linhas,
  reabrir,
} from './apoio.ts';

const arquivo = (buffer: Buffer, name = 'IMG_0001.jpg') => ({
  name,
  mimeType: 'image/jpeg',
  buffer,
});

/** "Tirar foto" de um item (o input da câmera dentro do <label>). */
const camera = (page: Page, item: string) => cartao(page, item).getByLabel(/Tirar foto/);

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

test('foto grande da câmera: grava em pé com no máximo 1600 px e continua lá ao reabrir offline', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);
  // 12 MP deitada, com EXIF "girar 90°" (celular em pé), como sai da câmera.
  const jpeg = await jpegDeCamera(page, 4000, 3000, 6);
  expect(jpeg.length).toBeGreaterThan(2_000_000);

  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg));
  const tapete = cartao(page, 'TAPETE');
  await expect(tapete.getByRole('button', { name: 'Ampliar foto 1 de 1' })).toBeVisible();
  await expect(tapete.getByText('1 foto', { exact: true })).toBeVisible();
  await expect(page.locator('.eq-fotos').getByText('1 foto')).toBeVisible(); // cabeçalho da ficha
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();

  const [f, ...resto] = await fotosNoBanco(page);
  expect(resto).toEqual([]);
  expect(f).toMatchObject({
    tipo: 'image/jpeg',
    largura: 1200,
    altura: 1600,
    real: [1200, 1600], // em pé, maior lado 1600
    miniatura: [240, 320],
    daPlaca: false,
  });
  expect(f!.bytes).toBeLessThan(jpeg.length / 2);
  // Girou certo: o canto de cima à esquerda da foto em pé é o de baixo à esquerda (azul).
  const [r, g, b] = f!.canto;
  expect(b).toBeGreaterThan(150);
  expect(Math.max(r, g)).toBeLessThan(90);
  await semRolagemLateral(page);

  await page.close(); // fechar à força

  const reaberta = await reabrir(context);
  const t = cartao(reaberta, 'TAPETE');
  await t.getByRole('button', { name: 'Ampliar foto 1 de 1' }).click();
  const dialogo = reaberta.getByRole('dialog', { name: 'Foto: TAPETE' });
  await expect(dialogo).toBeVisible();
  await expect
    .poll(() =>
      dialogo
        .getByRole('img')
        .evaluate((i: HTMLImageElement) => [i.complete, i.naturalWidth, i.naturalHeight]),
    )
    .toEqual([true, 1200, 1600]);
  await dialogo.getByRole('button', { name: 'Fechar' }).click();
  await expect(dialogo).toBeHidden();
});

test('5 fotos em itens diferentes (câmera, galeria e placa): lista e ficha contam sem recarregar; tudo volta offline', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);
  const jpeg = await jpegDeCamera(page, 2000, 1500);

  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg, 'a.jpg'));
  await camera(page, 'ROLETE DE CARGA').setInputFiles(arquivo(jpeg, 'b.jpg'));
  await camera(page, 'MANCAL').setInputFiles(arquivo(jpeg, 'c.jpg'));
  await cartao(page, 'REDUTOR')
    .getByLabel(/Foto da placa/)
    .setInputFiles(arquivo(jpeg, 'd.jpg'));
  // Da galeria (foto tirada antes, pela câmera do celular).
  await cartao(page, 'MOTOR').getByLabel('Galeria').last().setInputFiles(arquivo(jpeg, 'e.jpg'));

  await expect(page.locator('.eq-fotos').getByText('5 fotos')).toBeVisible();
  for (const item of ['TAPETE', 'ROLETE DE CARGA', 'MANCAL', 'MOTOR'])
    await expect(
      cartao(page, item).getByRole('button', { name: 'Ampliar foto 1 de 1' }),
    ).toBeVisible();
  const redutor = cartao(page, 'REDUTOR');
  await expect(redutor.getByRole('button', { name: 'Ampliar foto da placa 1' })).toBeVisible();
  await expect(redutor.locator('.miniatura-selo')).toHaveText('Placa');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();

  // Lista: "5 fotos" na linha do equipamento, sem recarregar.
  await page.goBack();
  await expect(linhas(page).filter({ hasText: 'XA-TC-01' }).getByText('5 fotos')).toBeVisible();
  await page.close();

  const reaberta = await reabrir(context);
  await expect(reaberta.locator('.eq-fotos').getByText('5 fotos')).toBeVisible();
  await expect(reaberta.locator('.miniatura img')).toHaveCount(5);
  const fotos = await fotosNoBanco(reaberta);
  expect(fotos).toHaveLength(5);
  expect(new Set(fotos.map((f) => f.alvoId)).size).toBe(5);
  expect(fotos.filter((f) => f.daPlaca)).toHaveLength(1);
  for (const f of fotos) {
    expect(f.real).toEqual([1600, 1200]);
    expect(f.tipo).toBe('image/jpeg');
  }
});

test('apagar pede confirmação; tocar de novo onde estava "Apagar", "Fechar" ou "Ampliar" não apaga', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const jpeg = await jpegDeCamera(page, 1200, 900);
  await page.getByLabel(/Foto do equipamento/).setInputFiles(arquivo(jpeg));
  await expect(page.locator('.eq-fotos').getByText('1 foto')).toBeVisible();

  await page.getByRole('button', { name: 'Ampliar foto 1 de 1' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Foto: XA-TC-01' });
  const centro = async (nome: string) => {
    const c = (await dialogo.getByRole('button', { name: nome, exact: true }).boundingBox())!;
    expect(c.height).toBeGreaterThanOrEqual(48);
    return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  };
  const antes = [await centro('Apagar'), await centro('Fechar'), await centro('Ampliar')];
  await dialogo.getByRole('button', { name: 'Apagar', exact: true }).click();

  await expect(dialogo.getByText('Apagar esta foto? Não dá para desfazer.')).toBeVisible();
  const sim = (await dialogo.getByRole('button', { name: 'Sim, apagar' }).boundingBox())!;
  const dentro = (p: { x: number; y: number }) =>
    p.x >= sim.x && p.x <= sim.x + sim.width && p.y >= sim.y && p.y <= sim.y + sim.height;
  expect(antes.filter(dentro)).toEqual([]); // nenhum toque repetido cai no "Sim, apagar"
  // Onde estavam "Fechar" e "Ampliar" agora é "Não, manter".
  const manter = (await dialogo.getByRole('button', { name: 'Não, manter' }).boundingBox())!;
  for (const p of antes.slice(1)) {
    expect(p.y).toBeGreaterThanOrEqual(manter.y);
    expect(p.y).toBeLessThanOrEqual(manter.y + manter.height);
  }
  expect(await fotosNoBanco(page)).toHaveLength(1); // perguntar não apaga

  await page.mouse.click(antes[1]!.x, antes[1]!.y); // mirou no "Fechar" de antes
  await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeVisible();
  expect(await fotosNoBanco(page)).toHaveLength(1);

  await dialogo.getByRole('button', { name: 'Apagar', exact: true }).click();
  await dialogo.getByRole('button', { name: 'Sim, apagar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.locator('.miniatura')).toHaveCount(0);
  await expect(page.locator('.eq-fotos')).toHaveCount(0);
  expect(await fotosNoBanco(page)).toHaveLength(0);

  await page.goBack();
  await expect(linhas(page).filter({ hasText: 'XA-TC-01' }).getByText(/foto/)).toBeHidden();
});

test('"Foto da placa" em destaque só no motor e no redutor; botões ≥ 48 px em 360 px', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  await expect(cartao(page, 'MOTOR').getByText('Foto da placa', { exact: true })).toBeVisible();
  await expect(cartao(page, 'REDUTOR').getByText('Foto da placa', { exact: true })).toBeVisible();
  await expect(cartao(page, 'TAPETE').getByText(/Foto da placa/)).toHaveCount(0);
  await expect(cartao(page, 'MANCAL').getByText(/Foto da placa/)).toHaveCount(0);

  // Câmera direta (traseira) e galeria: sempre <input type=file> dentro de <label>.
  const inputs = page.locator('label > input[type=file][accept="image/*"]');
  expect(await inputs.count()).toBeGreaterThan(10);
  await expect(camera(page, 'TAPETE')).toHaveAttribute('capture', 'environment');
  await expect(cartao(page, 'TAPETE').getByLabel('Galeria')).not.toHaveAttribute('capture');

  const alturas = await page
    .locator('.fotos-acoes > label')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...alturas)).toBeGreaterThanOrEqual(48);
  const placa = (await cartao(page, 'MOTOR')
    .getByText('Foto da placa', { exact: true })
    .boundingBox())!;
  expect(placa.height).toBeGreaterThanOrEqual(56);
  await semRolagemLateral(page);
});

test('"Salvando foto…" até o banco confirmar: a miniatura só aparece depois', async ({ page }) => {
  await compressaoLenta(page, 1500);
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const jpeg = await jpegDeCamera(page, 1600, 1200);

  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg));
  const tapete = cartao(page, 'TAPETE');
  await expect(tapete.getByText('Salvando…')).toBeVisible();
  await expect(page.getByText('Salvando foto…')).toBeVisible(); // no topo
  await expect(tapete.getByRole('button', { name: /Ampliar foto/ })).toHaveCount(0);
  expect(await fotosNoBanco(page)).toHaveLength(0);

  await expect(tapete.getByRole('button', { name: 'Ampliar foto 1 de 1' })).toBeVisible();
  await expect(tapete.getByText('Salvando…')).toBeHidden();
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  expect(await fotosNoBanco(page)).toHaveLength(1);
});

test('celular cheio: avisa no cartão e no topo, nada aparece como salvo; liberou espaço → "Tentar de novo" grava', async ({
  page,
}) => {
  // Enquanto a marca existir, o IndexedDB recusa gravar fotos (celular cheio).
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, valor, chave) {
      if (this.name === 'fotos' && localStorage.getItem('teste:fotos-cheio') === '1')
        throw new DOMException('Sem espaço', 'QuotaExceededError');
      return put.call(this, valor, chave);
    };
  });
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  await page.evaluate(() => localStorage.setItem('teste:fotos-cheio', '1'));
  const jpeg = await jpegDeCamera(page, 1600, 1200);

  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg));
  const tapete = cartao(page, 'TAPETE');
  await expect(tapete.getByRole('alert')).toContainText(
    'Celular sem espaço: a foto não foi salva.',
  );
  await expect(tapete.locator('.miniatura')).toHaveCount(0);
  await expect(page.locator('.eq-fotos')).toHaveCount(0);
  expect(await fotosNoBanco(page)).toHaveLength(0);
  // As medidas seguem gravando, mas o topo não diz "✓ Salvo" com foto pendente.
  await tapete.getByRole('textbox', { name: 'Largura' }).fill('658');
  await expect(page.getByRole('button', { name: 'Foto não salva' })).toBeVisible();

  // Da lista, o topo leva de volta ao aviso.
  await page.goBack();
  await page.getByRole('button', { name: 'Foto não salva' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
  await expect(cartao(page, 'TAPETE').getByRole('alert')).toBeInViewport();

  // Liberou espaço: grava sem precisar tirar a foto de novo.
  await page.evaluate(() => localStorage.removeItem('teste:fotos-cheio'));
  await cartao(page, 'TAPETE').getByRole('button', { name: 'Tentar de novo (1)' }).click();
  await expect(
    cartao(page, 'TAPETE').getByRole('button', { name: 'Ampliar foto 1 de 1' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  await expect(cartao(page, 'TAPETE').getByRole('textbox', { name: 'Largura' })).toHaveValue('658');
  expect(await fotosNoBanco(page)).toHaveLength(1);
});

test('pouco espaço no celular: aviso na ficha e no rodapé da lista', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(StorageManager.prototype, 'estimate', {
      value: async () => ({ usage: 1e9, quota: 1e9 + 20e6 }), // 20 MB livres
    });
  });
  await page.goto('./');
  await importarFixture(page);
  await expect(page.getByText('Espaço para ~40 fotos')).toHaveAttribute('data-estado', 'alerta');
  await abrirFicha(page, 'XA-TC-01');
  await expect(page.getByText('Pouco espaço no celular: cabem ~40 fotos.')).toBeVisible();
});

test('Android recarregou a página ao voltar da câmera: o cartão avisa que a foto não foi salva', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const motor = cartao(page, 'MOTOR');

  // Abre a câmera (toque de verdade no <label>) e a página "morre" antes de a foto voltar.
  const seletor = page.waitForEvent('filechooser');
  await motor.getByText('Tirar foto', { exact: true }).click();
  expect((await seletor).element()).toBeTruthy();
  await page.reload();

  const aviso = cartao(page, 'MOTOR').getByRole('alert');
  await expect(aviso).toContainText('A foto não foi salva: o app fechou antes de gravar');
  await expect(aviso).toBeInViewport(); // a ficha voltou onde estava
  await expect(page.getByRole('alert')).toHaveCount(1); // só no item da foto
  await expect(page.getByRole('button', { name: 'Foto não salva' })).toBeVisible();
  await aviso.getByRole('button', { name: 'Entendi' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();

  // Câmera aberta e foto chegando normalmente: nada de aviso depois.
  const jpeg = await jpegDeCamera(page, 1600, 1200);
  const outro = page.waitForEvent('filechooser');
  await cartao(page, 'MOTOR').getByText('Tirar foto', { exact: true }).click();
  await (await outro).setFiles(arquivo(jpeg));
  await expect(
    cartao(page, 'MOTOR').getByRole('button', { name: 'Ampliar foto 1 de 1' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    cartao(page, 'MOTOR').getByRole('button', { name: 'Ampliar foto 1 de 1' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

/** Compressão lenta (celular fraco): cada JPEG demora `ms` para sair. */
async function compressaoLenta(page: Page, ms: number) {
  await page.addInitScript((espera) => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, cb, ...resto) {
      toBlob.call(this, (b) => setTimeout(() => cb(b), espera), ...resto);
    };
  }, ms);
}

test('foto ainda gravando e câmera aberta em outro item quando a página morre: os dois cartões avisam', async ({
  page,
}) => {
  await compressaoLenta(page, 4000);
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const jpeg = await jpegDeCamera(page, 1600, 1200);

  // Foto do TAPETE chegou e está em "Salvando…" (a anotação fica até o banco confirmar).
  const primeira = page.waitForEvent('filechooser');
  await cartao(page, 'TAPETE').getByText('Tirar foto', { exact: true }).click();
  await (await primeira).setFiles(arquivo(jpeg));
  await expect(cartao(page, 'TAPETE').getByText('Salvando…')).toBeVisible();
  // …e a câmera já está aberta de novo, agora para o MANCAL.
  const segunda = page.waitForEvent('filechooser');
  await cartao(page, 'MANCAL').getByText('Tirar foto', { exact: true }).click();
  await segunda;
  await page.reload();

  await expect(cartao(page, 'TAPETE').getByRole('alert')).toContainText('A foto não foi salva');
  await expect(cartao(page, 'MANCAL').getByRole('alert')).toContainText('A foto não foi salva');
  expect(await fotosNoBanco(page)).toHaveLength(0);
});

test('duas fotos seguidas no mesmo item: a 1ª grava, a 2ª (câmera aberta) avisa se a página morrer', async ({
  page,
}) => {
  await compressaoLenta(page, 1500);
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const jpeg = await jpegDeCamera(page, 1600, 1200);
  const tapete = cartao(page, 'TAPETE');

  const primeira = page.waitForEvent('filechooser');
  await tapete.getByText('Tirar foto', { exact: true }).click();
  await (await primeira).setFiles(arquivo(jpeg));
  const segunda = page.waitForEvent('filechooser');
  await tapete.getByText('Tirar foto', { exact: true }).click(); // ainda "Salvando…" a 1ª
  await segunda;
  // A 1ª termina de gravar com a câmera da 2ª aberta: a anotação da 2ª tem que ficar.
  await expect(tapete.getByRole('button', { name: 'Ampliar foto 1 de 1' })).toBeVisible();
  await page.reload();

  await expect(cartao(page, 'TAPETE').getByRole('alert')).toContainText('A foto não foi salva');
  await expect(
    cartao(page, 'TAPETE').getByRole('button', { name: 'Ampliar foto 1 de 1' }),
  ).toBeVisible();
});

test('fechou o app durante o "Salvando foto…": ao reabrir, o cartão avisa', async ({
  page,
  context,
}) => {
  await compressaoLenta(page, 4000);
  await fichaOffline(page, context);
  const jpeg = await jpegDeCamera(page, 1600, 1200);
  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg));
  await expect(page.getByText('Salvando foto…')).toBeVisible();
  await page.close(); // deslizou o app para fora nos recentes

  const reaberta = await reabrir(context);
  await expect(cartao(reaberta, 'TAPETE').getByRole('alert')).toContainText('A foto não foi salva');
  await expect(reaberta.getByRole('button', { name: 'Foto não salva' })).toBeVisible();
});
