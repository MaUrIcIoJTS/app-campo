import { expect, test, type Page } from '@playwright/test';
import { abrirFicha, cartao, fichaOffline, importarFixture, linhas, reabrir } from './apoio.ts';

/** 20 medidas em 4 itens do XA-TC-01: [item, campo, valor digitado]. */
const MEDIDAS: ReadonlyArray<readonly [string, string, string]> = [
  ['TAPETE', 'Largura', '658,4'],
  ['TAPETE', 'Lonas', '2'],
  ['TAPETE', 'Coberturas', '3/16 X 1/16'],
  ['TAPETE', 'Espessura total', '9,5'],
  ['TAPETE', 'Comprimento', '23'],
  ['TAPETE', 'Centro a centro LD', '12450'],
  ['TAPETE', 'Centro a centro LE', '12480'],
  ['ROLETE DE CARGA', 'A —', '212'],
  ['ROLETE DE CARGA', 'B —', '250'],
  ['ROLETE DE CARGA', 'C —', '101,6'],
  ['ROLETE DE CARGA', 'D —', '14'],
  ['ROLETE DE CARGA', 'E —', '20'],
  ['ROLETE DE CARGA', 'Quantidade', '39'],
  ['ROLETE DE RETORNO', 'A —', '672'],
  ['ROLETE DE RETORNO', 'B —', '702'],
  ['ROLETE DE RETORNO', 'C —', '100'],
  ['ROLETE DE RETORNO', 'D —', '14'],
  ['ROLETE DE RETORNO', 'E —', '20'],
  ['REDUTOR', 'Redução', '1:30'],
  ['REDUTOR', 'Nº de série', '0000000001'],
];

const campo = (page: Page, item: string, rotulo: string) =>
  cartao(page, item).getByRole('textbox', { name: rotulo });

test('20 medidas, ✓/✗ e observações: fecha logo depois e reabre offline — tudo lá', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);

  for (const [item, rotulo, valor] of MEDIDAS) await campo(page, item, rotulo).fill(valor);
  const tapete = cartao(page, 'TAPETE');
  await tapete.getByRole('button', { name: 'Largura: diverge' }).click();
  await tapete.getByRole('button', { name: 'Lonas: confere' }).click();
  await tapete.getByRole('textbox', { name: 'Observação do item' }).fill('Emenda a 3 m da cabeça');
  await page
    .getByRole('textbox', { name: 'Observação do equipamento' })
    .fill('Esticador no fim do curso');

  // Na tela, na hora: Δ, aviso LD ≠ LE e item divergente.
  await expect(tapete.getByText('Δ −2 mm')).toBeVisible();
  await expect(tapete.getByText(/LD e LE diferentes: 30 mm/)).toBeVisible();
  await expect(tapete.getByText('Diverge')).toBeVisible();
  // Diverge não depende só da cor: o selo tem o ícone ✗ desenhado.
  await expect(tapete.locator('.item-estado--diverge svg')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.close(); // "fechar à força", sem esperar o "Salvo no aparelho"

  const reaberta = await reabrir(context);
  for (const [item, rotulo, valor] of MEDIDAS) {
    await expect(campo(reaberta, item, rotulo)).toHaveValue(valor);
  }
  const t = cartao(reaberta, 'TAPETE');
  await expect(t.getByRole('button', { name: 'Largura: diverge' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(t.getByRole('button', { name: 'Lonas: confere' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(t.getByRole('textbox', { name: 'Observação do item' })).toHaveValue(
    'Emenda a 3 m da cabeça',
  );
  await expect(reaberta.getByRole('textbox', { name: 'Observação do equipamento' })).toHaveValue(
    'Esticador no fim do curso',
  );
  await expect(reaberta.getByText('1 diverge')).toBeVisible();

  // A lista mostra o progresso sem precisar recarregar.
  await reaberta.getByRole('link', { name: /Lista/ }).first().click();
  const linha = linhas(reaberta).filter({ hasText: 'XA-TC-01' });
  await expect(linha.getByText('1 diverge')).toBeVisible();
  await expect(linha.locator('.eq-pct')).not.toHaveText('0%');
});

test('fecha 100 ms depois de digitar (antes da gravação): o valor continua lá', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);
  await campo(page, 'TAPETE', 'Largura').fill('658,4');
  await page.waitForTimeout(100); // a fila só grava depois de 300 ms
  const noDiario = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.startsWith('diario:medicao:')),
  );
  expect(noDiario).toBe(true);
  await page.close();

  const reaberta = await reabrir(context);
  await expect(campo(reaberta, 'TAPETE', 'Largura')).toHaveValue('658,4');
});

test('app morto de repente (sem pagehide): o diário recupera o último valor', async ({
  page,
  context,
  browser,
}) => {
  await fichaOffline(page, context);
  await campo(page, 'TAPETE', 'Largura').fill('658,4');
  await campo(page, 'TAPETE', 'Lonas').fill('2');
  // Mata o processo da página na hora (SIGKILL), como o Android faz: nenhum evento chega ao
  // app, nem pagehide. Este navegador só tem esta página aberta agora.
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  const caiu = page.waitForEvent('crash');
  for (const p of processInfo) if (p.type === 'renderer') process.kill(p.id, 'SIGKILL');
  await caiu;

  // Antes de abrir o app: o valor NÃO está no IndexedDB, só no diário.
  const espia = await context.newPage();
  await espia.goto('./manifest.webmanifest');
  const estado = await espia.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('levantamento-pcm');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const medicoes = await new Promise<unknown[]>((ok) => {
      const req = db.transaction('medicoes').objectStore('medicoes').getAll();
      req.onsuccess = () => ok(req.result);
    });
    db.close();
    return {
      noBanco: medicoes.length,
      noDiario: Object.keys(localStorage).filter((k) => k.startsWith('diario:medicao:')).length,
    };
  });
  expect(estado).toEqual({ noBanco: 0, noDiario: 1 });
  await espia.close();

  const reaberta = await reabrir(context);
  await expect(campo(reaberta, 'TAPETE', 'Largura')).toHaveValue('658,4');
  await expect(campo(reaberta, 'TAPETE', 'Lonas')).toHaveValue('2');
  // Reaplicado: foi para o banco e saiu do diário.
  await expect
    .poll(() =>
      reaberta.evaluate(
        () => Object.keys(localStorage).filter((k) => k.startsWith('diario:')).length,
      ),
    )
    .toBe(0);
});

test('"próximo" do teclado vai para o próximo campo; "Próximo item" leva ao item seguinte', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');

  await campo(page, 'TAPETE', 'Largura').fill('658');
  await campo(page, 'TAPETE', 'Largura').press('Enter');
  await expect(campo(page, 'TAPETE', 'Lonas')).toBeFocused();

  await cartao(page, 'TAPETE').getByRole('button', { name: 'Próximo item' }).click();
  const titulo = cartao(page, 'ROLETE DE CARGA').getByRole('heading');
  await expect(titulo).toBeInViewport();
  const y = (await titulo.boundingBox())!.y;
  expect(y).toBeGreaterThanOrEqual(56); // não fica embaixo da barra do topo
  expect(y).toBeLessThan(160);
});

test('"Próximo equipamento" troca a ficha sem empilhar histórico', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const naFicha = await page.evaluate(() => history.length);

  await page.getByRole('link', { name: /Próximo equipamento/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-02' })).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => history.length)).toBe(naFicha);

  await page.getByRole('link', { name: 'Voltar para a lista' }).click();
  await expect(linhas(page)).toHaveCount(9);
  expect(await page.evaluate(() => history.length)).toBe(naFicha); // voltou, não empilhou
});

test('opções viram botões grandes; tocar de novo desmarca', async ({ page }) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
  const saida = cartao(page, 'REDUTOR').getByRole('group', { name: 'Saída' });
  const vazado = saida.getByRole('button', { name: 'Eixo vazado' });
  await vazado.click();
  await expect(vazado).toHaveAttribute('aria-pressed', 'true');
  const caixa = (await vazado.boundingBox())!;
  expect(caixa.height).toBeGreaterThanOrEqual(48);
  await vazado.click();
  await expect(vazado).toHaveAttribute('aria-pressed', 'false');
});

test('banco cheio ao reabrir: a medida do diário aparece e não some na edição seguinte', async ({
  page,
  context,
}) => {
  // Enquanto a marca existir, o IndexedDB recusa gravar medições (celular sem espaço).
  await context.addInitScript(() => {
    if (localStorage.getItem('teste:banco-cheio') !== '1') return;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, valor, chave) {
      if (this.name === 'medicoes') throw new DOMException('Sem espaço', 'QuotaExceededError');
      return put.call(this, valor, chave);
    };
  });
  await fichaOffline(page, context);
  await campo(page, 'TAPETE', 'Largura').fill('658,4');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();

  await page.evaluate(() => localStorage.setItem('teste:banco-cheio', '1'));
  await page.reload(); // agora com o banco cheio (continua na ficha)
  await expect(page.getByRole('heading', { level: 1, name: 'XA-TC-01' })).toBeVisible();
  await campo(page, 'TAPETE', 'Lonas').fill('2');
  await expect(page.getByRole('button', { name: /Celular sem espaço/ })).toBeVisible();
  await page.close();

  const cheia = await reabrir(context); // ainda cheio
  await expect(campo(cheia, 'TAPETE', 'Lonas')).toHaveValue('2');
  await expect(cheia.getByRole('button', { name: /Celular sem espaço/ })).toBeVisible();
  await campo(cheia, 'TAPETE', 'Comprimento').fill('23');
  await cheia.evaluate(() => localStorage.removeItem('teste:banco-cheio')); // liberou espaço
  await cheia.close();

  const livre = await reabrir(context);
  await expect(campo(livre, 'TAPETE', 'Largura')).toHaveValue('658,4');
  await expect(campo(livre, 'TAPETE', 'Lonas')).toHaveValue('2');
  await expect(campo(livre, 'TAPETE', 'Comprimento')).toHaveValue('23');
  await expect(livre.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
});

test('app aberto em duas janelas: uma não apaga a medida da outra', async ({ page, context }) => {
  await fichaOffline(page, context);
  const outra = await reabrir(context); // ex.: aba do Chrome que ficou aberta + app instalado

  await campo(page, 'TAPETE', 'Largura').fill('658,4');
  await expect(campo(outra, 'TAPETE', 'Largura')).toHaveValue('658,4'); // chegou na outra
  await campo(outra, 'TAPETE', 'Lonas').fill('2');
  await expect(campo(page, 'TAPETE', 'Lonas')).toHaveValue('2');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  await expect(outra.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  await page.close();
  await outra.close();

  const reaberta = await reabrir(context);
  await expect(campo(reaberta, 'TAPETE', 'Largura')).toHaveValue('658,4');
  await expect(campo(reaberta, 'TAPETE', 'Lonas')).toHaveValue('2');
});

test('"Não tem", índice de itens, nome do item preso no topo e volta onde parou', async ({
  page,
}) => {
  await page.goto('./');
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');

  // Campo sem valor no PCM: "Não tem" no lugar de ✓/✗, e conta como feito.
  const tambor = cartao(page, 'TAMBOR 1');
  await expect(
    tambor.getByRole('button', { name: 'Ø ponta (redutor ou acoplamento): confere' }),
  ).toHaveCount(0);
  await expect(tambor.getByRole('button', { name: 'Ø eixo no mancal: confere' })).toBeVisible();
  const naoTem = tambor.getByRole('button', { name: 'Ø ponta (redutor ou acoplamento): não tem' });
  await naoTem.click();
  await expect(naoTem).toHaveAttribute('aria-pressed', 'true');
  await expect(tambor.locator('.item-estado')).toHaveText('1/7');

  // Índice: pula direto para o motor.
  await page.getByText('Ir para item…').click();
  await page.locator('.indice-item', { hasText: /^MOTOR/ }).click();
  const motor = cartao(page, 'MOTOR').getByRole('heading');
  await expect(motor).toBeInViewport();
  expect((await motor.boundingBox())!.y).toBeLessThan(160);

  // Teclado "próximo" entrando no rolete de retorno: o nome dele fica visível sob a barra.
  await campo(page, 'ROLETE DE CARGA', 'Quantidade').fill('39');
  await campo(page, 'ROLETE DE CARGA', 'Quantidade').press('Enter'); // → observação
  await cartao(page, 'ROLETE DE CARGA')
    .getByRole('textbox', { name: 'Observação do item' })
    .press('Enter'); // → A do rolete de retorno
  await expect(campo(page, 'ROLETE DE RETORNO', 'A —')).toBeFocused();
  const titulo = cartao(page, 'ROLETE DE RETORNO').getByRole('heading');
  const barra = (await page.locator('.topo').boundingBox())!;
  expect((await titulo.boundingBox())!.y).toBeGreaterThanOrEqual(barra.y + barra.height - 1);
  await expect(titulo).toBeInViewport();

  // Sai para a lista com o "voltar" do Android e volta: a ficha abre onde parou, não no topo.
  // (Não clica no "‹ Lista": o click do Playwright num elemento sticky rola a página antes.)
  const parou = await page.evaluate(() => window.scrollY);
  expect(parou).toBeGreaterThan(1000);
  await page.goBack();
  await expect(linhas(page)).toHaveCount(9);
  await abrirFicha(page, 'XA-TC-01');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(parou - 50);
});
