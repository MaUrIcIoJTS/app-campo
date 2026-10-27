import { expect, test, type Page } from '@playwright/test';
import {
  abrirFicha,
  abrirGuia,
  cartao,
  fichaOffline,
  guia,
  importarFixture,
  linhas,
  noItem,
  reabrir,
} from './apoio.ts';

const nomesDasGuias = (page: Page) =>
  page.getByRole('tab').evaluateAll((els) => els.map((e) => e.id.replace('guia-', '')));

/** Toque de dedo no centro do elemento (sem o "rolar até" do click do Playwright). */
async function tocar(page: Page, alvo: ReturnType<Page['locator']>) {
  const c = (await alvo.boundingBox())!;
  await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
}

test('guias da ficha: só as que têm item, ≥ 48 px; só a barra rola de lado, a página não', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  expect(await nomesDasGuias(page)).toEqual([
    'pcm',
    'correia',
    'tambores',
    'roletes',
    'acionamento',
    'outros',
    'fotos',
    'notas',
  ]);
  // Abre na primeira guia de medida.
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Correia');
  const alturas = await page
    .getByRole('tab')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...alturas)).toBeGreaterThanOrEqual(48);
  const barra = page.locator('.guias');
  expect(await barra.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  // A última guia, escolhida, fica inteira à vista dentro da barra.
  await abrirGuia(page, 'Notas');
  const notas = (await guia(page, 'Notas').boundingBox())!;
  expect(notas.x).toBeGreaterThanOrEqual(0);
  expect(notas.x + notas.width).toBeLessThanOrEqual(360);

  // Peneira: sem correia, tambor nem rolete.
  await page.goto('./#/');
  await abrirFicha(page, 'XB-PV-01');
  expect(await nomesDasGuias(page)).toEqual(['pcm', 'acionamento', 'outros', 'fotos', 'notas']);
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Acionamento');
});

test('digitou e trocou de guia na hora (antes da gravação): fecha o app e o valor está lá', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);
  await cartao(page, 'TAPETE').getByRole('textbox', { name: 'Largura' }).fill('658,4');
  await abrirGuia(page, 'Tambores'); // o cartão do tapete sai da tela com a gravação pendente
  await (
    await noItem(page, 'TAMBOR 1')
  )
    .getByRole('textbox', { name: 'Mancal (código gravado)' })
    .fill('SNA 515');
  await abrirGuia(page, 'Notas');
  await page.close(); // fechar à força, sem esperar o "Salvo no aparelho"

  const reaberta = await reabrir(context);
  await expect(cartao(reaberta, 'TAPETE').getByRole('textbox', { name: 'Largura' })).toHaveValue(
    '658,4',
  );
  await expect(
    (await noItem(reaberta, 'TAMBOR 1')).getByRole('textbox', {
      name: 'Mancal (código gravado)',
    }),
  ).toHaveValue('SNA 515');
});

test('Android recarregou (câmera): volta na mesma guia e no mesmo lugar; o "voltar" vai para a lista', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const naFicha = await page.evaluate(() => history.length);
  // Aberta pela lista (endereço sem guia): recarregar volta na mesma guia, não no PCM.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Correia');

  for (const nome of ['Tambores', 'PCM', 'Acionamento', 'Roletes']) await abrirGuia(page, nome);
  expect(await page.evaluate(() => history.length)).toBe(naFicha); // guia não empilha histórico
  await expect(page).toHaveURL(/\/roletes$/);
  await cartao(page, 'ROLETE DE RETORNO').getByRole('heading').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  const y = await page.evaluate(() => window.scrollY);

  await page.reload();
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Roletes');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 50);

  await page.goBack();
  await expect(linhas(page)).toHaveCount(10);

  // A guia lembrada é a que estava aberta, mesmo quando o app trocou de guia sozinho (ex.:
  // "Foto não salva" no topo leva à guia do item).
  await abrirFicha(page, 'XA-TC-01');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Roletes');
  await page.evaluate(() =>
    location.replace(`${location.hash.split('/').slice(0, 3).join('/')}/acionamento`),
  );
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Acionamento');
  await page.goBack();
  await abrirFicha(page, 'XA-TC-01');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Acionamento');
});

test('voltar a uma guia cai onde parou; a TAG aparece no topo ao rolar', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const tag = page.locator('.topo-contexto');
  await expect(tag).toHaveText('XA-TC-01');
  await expect(tag).toHaveCSS('opacity', '0'); // o cabeçalho ainda está na tela

  await abrirGuia(page, 'Tambores');
  await cartao(page, 'TAMBOR 2')
    .getByRole('heading', { name: 'TAMBOR 2' })
    .scrollIntoViewIfNeeded();
  const parou = await page.evaluate(() => window.scrollY);
  expect(parou).toBeGreaterThan(1500);
  await expect(tag).toHaveCSS('opacity', '1'); // rolou: sabe em que equipamento está

  await tocar(page, guia(page, 'Correia')); // foi conferir uma coisa…
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Correia');
  await tocar(page, guia(page, 'Tambores')); // …e voltou
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(parou - 50);
  await expect(
    cartao(page, 'TAMBOR 2').getByRole('heading', { name: 'TAMBOR 2' }),
  ).toBeInViewport();
});

test('teclado aberto: a barra de guias solta do topo e o rótulo do campo fica à vista', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 400 }); // o teclado come a metade de baixo
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const tambor = await noItem(page, 'TAMBOR 1');
  const mancal = tambor.getByRole('textbox', { name: 'Mancal (código gravado)' });
  await mancal.fill('SNA 515');
  await mancal.press('Enter'); // "próximo" do teclado → Rolamento
  const rolamento = tambor.getByRole('textbox', { name: 'Rolamento' });
  await expect(rolamento).toBeFocused();
  await expect(page.locator('.guias')).toHaveCSS('position', 'relative');
  // O rótulo "Rolamento" fica abaixo do que está preso no topo (barra + nome do item).
  const preso = (await tambor.locator('.item-topo').boundingBox())!;
  const rotulo = (await tambor.locator('label', { hasText: /^Rolamento$/ }).boundingBox())!;
  expect(rotulo.y).toBeGreaterThanOrEqual(preso.y + preso.height - 1);

  await rolamento.blur();
  await expect(page.locator('.guias')).toHaveCSS('position', 'sticky');
});

test('tocar numa guia com a tela rolada leva ao começo dela, com a barra presa sob o topo', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  await page.evaluate(() => window.scrollTo(0, 900));
  await tocar(page, guia(page, 'Tambores'));
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Tambores');

  const topo = (await page.locator('.topo').boundingBox())!;
  const barra = (await page.locator('.guias').boundingBox())!;
  expect(Math.abs(barra.y - (topo.y + topo.height))).toBeLessThanOrEqual(1);
  await expect(page.locator('.guias')).toHaveAttribute('data-presa', 'true');
  // O começo da guia (título e desenho) logo abaixo das barras.
  const titulo = (await page.locator('.guia-titulo').boundingBox())!;
  expect(titulo.y).toBeGreaterThanOrEqual(barra.y + barra.height - 1);
  expect(titulo.y).toBeLessThan(barra.y + barra.height + 40);
});

test('"Seguir para…" passa por todas as guias até Notas e o próximo equipamento', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  for (const proxima of ['Tambores', 'Roletes', 'Acionamento', 'Outros', 'Fotos', 'Notas']) {
    const seguir = page.getByRole('button', { name: new RegExp(`^Seguir para ${proxima}`) });
    await seguir.scrollIntoViewIfNeeded();
    expect((await seguir.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    await seguir.click();
    await expect(page.getByRole('tab', { selected: true })).toHaveText(new RegExp(`^${proxima}`));
  }
  await expect(page.getByRole('button', { name: /^Seguir para/ })).toHaveCount(0);

  // Antes de "Próximo equipamento": o que ainda falta, guia por guia (nada medido ainda).
  const falta = page.locator('.falta .pcm-linha');
  await expect(falta).toHaveText([
    /^Correia\s*1 item/,
    /^Tambores\s*5 itens/,
    /^Roletes\s*2 itens/,
    /^Acionamento\s*4 itens/,
    /^Outros\s*1 item/,
  ]);
  await falta.filter({ hasText: 'Roletes' }).click();
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Roletes');
  await abrirGuia(page, 'Notas');

  // Uma observação marca a guia Notas (não fica esquecida na última guia).
  await page.getByRole('textbox', { name: 'Observação do equipamento' }).fill('Proteção solta');
  await expect(guia(page, 'Notas')).toHaveAccessibleName('Notas 1');

  await page.getByRole('link', { name: /Próximo equipamento/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-02' })).toBeVisible();
});

test('tambor: mancal, rolamento e bucha com o PCM do equipamento; guia avisa feito e diverge', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const tambor = await noItem(page, 'TAMBOR 1');
  await expect(tambor.getByRole('heading', { name: 'Mancal e rolamento' })).toBeVisible();
  const pcmDe = (rotulo: string) =>
    tambor.locator('.campo-med', { hasText: rotulo }).locator('.valor-pcm');
  await expect(pcmDe('Mancal (código gravado)')).toHaveText('SNA 515 EIXO 63');
  await expect(pcmDe('Rolamento')).toHaveText('ROLAMENTO AUTOCOMP. ROLOS 22215 K');
  await expect(pcmDe('Bucha')).toHaveText('HE 315');
  await tambor.getByRole('button', { name: 'Rolamento: diverge' }).click();
  await expect(guia(page, 'Tambores')).toHaveAccessibleName('Tambores diverge');
  // As linhas MANCAL/ROLAMENTO/BUCHA do PCM continuam, depois dos tambores.
  await expect(
    page.getByRole('heading', { name: 'Mancal, rolamento e bucha no PCM' }),
  ).toBeVisible();
  await expect(cartao(page, 'BUCHA')).toBeVisible();
  // O que foi anotado nos tambores aparece na linha do PCM, para conferir sem procurar.
  await tambor.getByRole('textbox', { name: 'Mancal (código gravado)' }).fill('SNA 515');
  await expect(cartao(page, 'MANCAL').locator('.item-anotado')).toHaveText(
    'Nos tambores: Tambor 1: SNA 515',
  );
  await expect(cartao(page, 'BUCHA').locator('.item-anotado')).toHaveCount(0);

  // Guia Fotos: "Sem foto ›" leva direto aos botões de foto do item.
  await abrirGuia(page, 'Fotos');
  await page.locator('.pcm-linha', { hasText: 'ROLETE DE RETORNO' }).click();
  await expect(page.getByRole('tab', { selected: true })).toHaveText('Roletes');
  await expect(
    cartao(page, 'ROLETE DE RETORNO').getByText('Tirar foto', { exact: true }),
  ).toBeInViewport();

  // Guia toda feita: ✓ no nome da guia.
  const chave = await noItem(page, 'CHAVE DE SEGURANÇA');
  await chave.getByRole('button', { name: 'Modelo / medida principal: confere' }).click();
  await chave.getByRole('button', { name: 'Quantidade: confere' }).click();
  await expect(guia(page, 'Outros')).toHaveAccessibleName('Outros feito');
});
