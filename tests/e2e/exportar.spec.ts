import { devices, expect, test, type Browser, type Download, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { lerPcm } from '../../src/dominio/pcm/parser.ts';
import {
  abrirFicha,
  abrirGuia,
  cartao,
  esperarServiceWorker,
  fichaOffline,
  FIXTURE,
  jpegDeCamera,
  linhas,
  linhasDoTexto,
  noItem,
} from './apoio.ts';

const arquivo = (buffer: Buffer, name: string) => ({ name, mimeType: 'image/jpeg', buffer });
const camera = (page: Page, item: string) => cartao(page, item).getByLabel(/Tirar foto/);
const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

/** Medidas, ✓/✗, "Não tem", observações e 2 fotos (uma da placa) no XA-TC-01. */
async function preencher(page: Page) {
  const tapete = await noItem(page, 'TAPETE');
  await tapete.getByRole('textbox', { name: 'Largura' }).fill('660');
  await tapete.getByRole('textbox', { name: 'Centro a centro LD' }).fill('12450');
  await tapete.getByRole('button', { name: 'Lonas: diverge' }).click();
  await tapete.getByRole('textbox', { name: 'Observação do item' }).fill('Emenda "nova" no LD');
  const jpeg = await jpegDeCamera(page, 2000, 1500);
  await camera(page, 'TAPETE').setInputFiles(arquivo(jpeg, 'a.jpg'));
  await expect(page.locator('.eq-fotos').getByText('1 foto')).toBeVisible();
  const tambor = await noItem(page, 'TAMBOR 1');
  await tambor.getByRole('button', { name: 'Ø ponta (redutor ou acoplamento): não tem' }).click();
  await tambor.getByRole('textbox', { name: 'Mancal (código gravado)' }).fill('SNA 515');
  await abrirGuia(page, 'Notas');
  await page.getByRole('textbox', { name: 'Observação do equipamento' }).fill('Proteção solta');
  await (
    await noItem(page, 'MOTOR')
  )
    .getByLabel(/Foto da placa/)
    .setInputFiles(arquivo(jpeg, 'b.jpg'));
  await expect(page.locator('.eq-fotos').getByText('2 fotos')).toBeVisible();
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
}

interface Estado {
  medicoes: unknown[];
  notas: unknown[];
  fotos: Record<string, unknown>[];
}

/** O que está no IndexedDB (medições, notas e fotos com o SHA-256 dos bytes), lido direto. */
function estadoDoBanco(page: Page): Promise<Estado> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('levantamento-pcm');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const todos = <T>(store: string) =>
      new Promise<T[]>((ok) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => ok(req.result as T[]);
      });
    const sha = async (b?: Blob) =>
      b
        ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))]
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('')
        : null;
    const [medicoes, notas, fotos] = await Promise.all([
      todos('medicoes'),
      todos('notas'),
      todos<{ blob: Blob; miniatura?: Blob } & Record<string, unknown>>('fotos'),
    ]);
    db.close();
    return {
      medicoes,
      notas,
      fotos: await Promise.all(
        fotos.map(async ({ blob, miniatura, ...resto }) => ({
          ...resto,
          tipo: blob.type,
          bytes: blob.size,
          sha: await sha(blob),
          miniatura: await sha(miniatura),
        })),
      ),
    };
  });
}

/** Toca em "Baixar" (o único visível) e devolve o download. */
async function baixar(page: Page, onde = page.locator('main')): Promise<Download> {
  const download = page.waitForEvent('download');
  await onde.getByRole('link', { name: 'Baixar', exact: true }).click();
  return download;
}

async function irParaBackup(page: Page) {
  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  await expect(linhas(page)).toHaveCount(15);
  await page.getByRole('link', { name: /Último backup|Nenhum backup/ }).click();
  await expect(page.getByRole('heading', { name: 'Backup e exportar' })).toBeVisible();
}

/** Outro celular: contexto novo, sem nada; instala o app com internet e liga o modo avião. */
async function outroAparelho(browser: Browser) {
  const contexto = await browser.newContext({
    ...devices['Galaxy S9+'],
    viewport: { width: 360, height: 740 },
    locale: 'pt-BR',
    serviceWorkers: 'allow',
    baseURL: test.info().project.use.baseURL,
  });
  const page = await contexto.newPage();
  await page.goto('./');
  await esperarServiceWorker(page);
  await contexto.setOffline(true);
  await page.reload();
  await expect(page.getByText('Nenhum PCM neste aparelho')).toBeVisible();
  return { contexto, page };
}

test('backup offline → outro aparelho limpo → restaurar: medidas, observações e fotos iguais (até os bytes)', async ({
  page,
  context,
  browser,
}) => {
  await fichaOffline(page, context);
  await preencher(page);
  const antes = await estadoDoBanco(page);
  expect(antes.fotos).toHaveLength(2);
  expect(antes.medicoes).toHaveLength(2);

  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  // Um bloco só de estado do aparelho no topo da lista, com o último backup dentro.
  const estado = page.getByRole('region', { name: 'Estado do aparelho' });
  await expect(estado.locator('.linha-backup')).toHaveText(/Nenhum backup ainda/);
  await page.getByRole('link', { name: /Último backup|Nenhum backup/ }).click();
  await semRolagemLateral(page);
  await page.getByRole('button', { name: 'Preparar backup' }).click();
  // Android: o Chrome não compartilha .json, então só "Baixar".
  await expect(page.getByRole('link', { name: 'Baixar', exact: true })).toBeVisible();
  // Antes de baixar, deixa claro que o backup ainda não foi salvo fora do app.
  await expect(page.getByText('Pronto para baixar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compartilhar' })).toHaveCount(0);
  const download = await baixar(page);
  expect(download.suggestedFilename()).toMatch(/^levantamento-backup-\d{4}-\d\d-\d\d-\d{4}\.json$/);
  // Depois de baixar: onde está e como mandar pelo WhatsApp, com o nome do arquivo. Testado no
  // Android em 25/10: o "clipe → Documento" do WhatsApp não lista .json; o caminho que funciona
  // é sair pelo app de arquivos do celular (Downloads → Compartilhar → WhatsApp).
  const feito = page.getByRole('status').filter({ hasText: 'Baixado às' });
  await expect(feito).toContainText('Downloads');
  await expect(feito).toContainText('segure o arquivo');
  await expect(feito).toContainText('app de arquivos do celular');
  // Título curto ("Backup de 26/10 14:30") e, embaixo, tamanho e nome do arquivo, para achar.
  await expect(page.getByText('Pronto para baixar')).toHaveCount(0);
  await expect(page.locator('.arquivo-titulo')).toHaveText(/^Backup de \d\d\/\d\d \d\d:\d\d$/);
  await expect(page.locator('.arquivo-nome')).toHaveText(
    new RegExp(`^\\d+ KB · ${download.suggestedFilename().replaceAll('.', '\\.')}$`),
  );
  await expect(feito).toContainText('Compartilhar → WhatsApp');
  await expect(feito).not.toContainText('Documento');
  await expect(page.getByRole('link', { name: 'Baixar de novo' })).toBeVisible();
  const caminho = test.info().outputPath('backup.json');
  await download.saveAs(caminho);
  const json = JSON.parse(readFileSync(caminho, 'utf8'));
  expect(json).toMatchObject({ formato: 'levantamento-pcm-backup', versao: 1 });
  expect(json.resumo).toMatchObject({ equipamentos: 15, medicoes: 2, notas: 1, fotos: 2 });
  await semRolagemLateral(page);

  // "Último backup" na tela inicial.
  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  await expect(estado.locator('.linha-backup')).toHaveText(/Último backup: agora há pouco/);

  // Fotos em .zip: nomes com TAG e item, bytes iguais aos do banco (sem recomprimir).
  await page.getByRole('link', { name: /Último backup|Nenhum backup/ }).click();
  await page.getByRole('button', { name: 'Preparar fotos' }).click();
  const zipBaixado = await baixar(page, page.locator('section', { hasText: 'Fotos (.zip)' }));
  expect(zipBaixado.suggestedFilename()).toMatch(/^fotos-\d{4}-\d\d-\d\d-\d{4}\.zip$/);
  const zip = await JSZip.loadAsync(readFileSync(await zipBaixado.path()), { checkCRC32: true });
  expect(Object.keys(zip.files)).toEqual(['XA-TC-01_TAPETE_1.jpg', 'XA-TC-01_MOTOR_PLACA_1.jpg']);
  const { createHash } = await import('node:crypto');
  const shaZip = await Promise.all(
    Object.values(zip.files).map(async (f) =>
      createHash('sha256')
        .update(await f.async('nodebuffer'))
        .digest('hex'),
    ),
  );
  expect(shaZip.sort()).toEqual(antes.fotos.map((f) => f.sha).sort());

  // Outro celular, limpo e em modo avião: restaurar pela tela vazia.
  const outro = await outroAparelho(browser);
  const p2 = outro.page;
  await p2.getByRole('link', { name: 'Restaurar backup' }).click();
  await p2.locator('input[type=file]').setInputFiles(caminho);
  // Prévia em tabela: o que o backup traz (o celular está vazio: só a coluna do backup).
  const linha = (rotulo: string) => p2.getByRole('row', { name: new RegExp(`^${rotulo}`) });
  await expect(linha('Equipamentos')).toHaveText(/Equipamentos\s*15$/);
  await expect(linha('Itens medidos')).toHaveText(/Itens medidos\s*2$/);
  await expect(linha('Obs. de equipamento')).toHaveText(/Obs. de equipamento\s*1$/);
  await expect(linha('Fotos')).toHaveText(/Fotos\s*2$/);
  await expect(p2.getByRole('columnheader', { name: 'Este celular' })).toHaveCount(0);
  await expect(p2.getByText('Este celular está vazio.')).toBeVisible();
  await semRolagemLateral(p2);
  // "Restaurar este backup" numa linha só em 360 px.
  const restaurar = p2.getByRole('button', { name: 'Restaurar este backup' });
  expect(await linhasDoTexto(restaurar)).toBe(1);
  await restaurar.click();
  await expect(p2.getByText(/Backup restaurado/)).toBeVisible();
  await expect(p2.getByText('Cópia de antes da restauração')).toHaveCount(0); // estava vazio
  await p2.getByRole('link', { name: 'Ir para a lista' }).click();
  await expect(linhas(p2)).toHaveCount(15);

  expect(await estadoDoBanco(p2)).toEqual(antes);
  await abrirFicha(p2, 'XA-TC-01');
  const tapete = await noItem(p2, 'TAPETE');
  await expect(tapete.getByRole('textbox', { name: 'Largura' })).toHaveValue('660');
  await expect(tapete.getByRole('textbox', { name: 'Observação do item' })).toHaveValue(
    'Emenda "nova" no LD',
  );
  await expect(tapete.getByRole('button', { name: 'Ampliar foto 1 de 1' })).toBeVisible();
  await expect(p2.locator('.eq-fotos').getByText('2 fotos')).toBeVisible();
  await expect(
    (await noItem(p2, 'TAMBOR 1')).getByRole('textbox', { name: 'Mancal (código gravado)' }),
  ).toHaveValue('SNA 515');
  await abrirGuia(p2, 'Notas');
  await expect(p2.getByRole('textbox', { name: 'Observação do equipamento' })).toHaveValue(
    'Proteção solta',
  );
  await outro.contexto.close();
});

test('PCM atualizado (.xlsx) offline: colunas na linha de cada item e reimporta sem perder nada', async ({
  page,
  context,
}) => {
  // Android: canShare diz que sim, share recusa o .xlsx (NotAllowedError). Na 1ª vez, cancela.
  // Fora do Android (iPhone) aparece "Compartilhar". Aqui o navegador recusa o .xlsx
  // (NotAllowedError, como faria o Chrome do Android); na 1ª vez, o técnico cancela.
  await context.addInitScript(() => {
    let vez = 0;
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    Object.assign(navigator, {
      canShare: () => true,
      share: () =>
        Promise.reject(new DOMException('x', vez++ === 0 ? 'AbortError' : 'NotAllowedError')),
    });
  });
  await fichaOffline(page, context);
  await preencher(page);
  await irParaBackup(page);
  await page.getByRole('button', { name: 'Preparar planilha' }).click();
  const secao = page.locator('section', { hasText: 'PCM atualizado (.xlsx)' });
  await expect(secao.getByText(/^pcm-atualizado-.*\.xlsx$/)).toBeVisible();
  await semRolagemLateral(page);

  // Cancelar a folha de compartilhar não é erro e não baixa nada.
  let baixou = false;
  page.on('download', () => (baixou = true));
  await secao.getByRole('button', { name: 'Compartilhar' }).click();
  await expect(secao.getByText(/não deixa compartilhar/)).toHaveCount(0);
  expect(baixou).toBe(false);
  // Recusado pelo navegador: baixa na hora e explica como mandar pelo WhatsApp.
  const download = page.waitForEvent('download');
  await secao.getByRole('button', { name: 'Compartilhar' }).click();
  const xlsx = await download;
  expect(baixou).toBe(true);
  const aviso = secao.getByRole('status').filter({ hasText: 'não deixa compartilhar' });
  await expect(aviso).toContainText('Compartilhar → WhatsApp');
  await expect(aviso).toContainText('Downloads');
  expect(xlsx.suggestedFilename()).toMatch(/^pcm-atualizado-\d{4}-\d\d-\d\d-\d{4}\.xlsx$/);
  const caminho = test.info().outputPath('pcm-atualizado.xlsx');
  await xlsx.saveAs(caminho);

  // Lido de volta: as 4 colunas na linha do item, abas novas, e o mesmo PCM para o parser.
  const bytes = readFileSync(caminho);
  // Formatada no navegador (não caiu no "sem formatação"): cabeçalho congelado e vermelho.
  const partes = await JSZip.loadAsync(bytes, { checkCRC32: true });
  expect(await partes.file('xl/worksheets/sheet1.xml')!.async('string')).toContain(
    'state="frozen"',
  );
  expect(await partes.file('xl/styles.xml')!.async('string')).toContain('FFC00000');
  const wb = XLSX.read(bytes);
  expect(wb.SheetNames).toEqual(['AREA 1', 'SECAGEM E CLASSIFICAÇÃO', 'Resumo', 'Fora do PCM']);
  const area1 = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['AREA 1']!, {
    header: 1,
    defval: '',
    raw: false,
  });
  const cab = area1.findIndex((l) => /^EQUIPAMENTOS PARA INSP/.test(l[0]!));
  const col = area1[cab]!.indexOf('Medido');
  expect(area1[cab]!.slice(col)).toEqual(['Medido', 'Confere/Diverge', 'Observação', 'Data']);
  const tapete = area1.find((l) => l[1] === 'TAPETE')!;
  expect(tapete.slice(col, col + 3)).toEqual([
    'Largura: 660 mm (Δ −0,4); Centro a centro LD: 12450 mm',
    'Diverge: Lonas',
    'Emenda "nova" no LD (1 foto)',
  ]);
  expect(tapete[col + 3]).toMatch(/^\d\d\/\d\d\/\d{4} \d\d:\d\d$/);
  const fora = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Fora do PCM']!, {
    header: 1,
    defval: '',
  });
  // O mancal anotado no tambor vai junto, na linha do tambor.
  expect(fora[3]!.slice(3, 5)).toEqual([
    'TAMBOR 1',
    'Ø ponta (redutor ou acoplamento): não se aplica; Mancal (código gravado): SNA 515',
  ]);
  expect(lerPcm(bytes)).toEqual(lerPcm(readFileSync(FIXTURE)));

  // Subir o PCM atualizado no app: mesmos 15 equipamentos e as medidas continuam.
  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  await page.getByRole('link', { name: 'Trocar o PCM' }).click();
  await page.locator('input[type=file]').setInputFiles(caminho);
  await expect(page.getByText(/Nada será apagado/)).toBeVisible();
  await expect(page.getByText(/mudou de linha|mudaram de linha|Fora do PCM atual/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Trocar o PCM (15 equipamentos)' }).click();
  await expect(linhas(page)).toHaveCount(15);
  await expect(page.getByText('Fora do PCM atual')).toHaveCount(0);
  await abrirFicha(page, 'XA-TC-01');
  await expect(
    (await noItem(page, 'TAPETE')).getByRole('textbox', { name: 'Largura' }),
  ).toHaveValue('660');
  await expect(page.locator('.eq-fotos').getByText('2 fotos')).toBeVisible();
});

test('restaurar: backup inválido não apaga nada; o válido guarda antes uma cópia automática', async ({
  page,
  context,
}) => {
  await fichaOffline(page, context);
  const largura = () => cartao(page, 'TAPETE').getByRole('textbox', { name: 'Largura' });
  await largura().fill('660');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  await irParaBackup(page);
  await page.getByRole('button', { name: 'Preparar backup' }).click();
  const caminho = test.info().outputPath('backup.json');
  await (await baixar(page)).saveAs(caminho);

  // Depois do backup, o técnico continua medindo.
  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  await abrirFicha(page, 'XA-TC-01');
  await largura().fill('999');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  const antes = await estadoDoBanco(page);
  await irParaBackup(page);
  await page.getByRole('link', { name: 'Restaurar um backup' }).click();

  // Arquivo cortado (download interrompido) e arquivo que não é backup: recusados.
  const texto = readFileSync(caminho, 'utf8');
  const cortado = test.info().outputPath('cortado.json');
  writeFileSync(cortado, texto.slice(0, Math.floor(texto.length * 0.6)));
  await page.locator('input[type=file]').setInputFiles(cortado);
  await expect(page.getByRole('alert')).toHaveText(/incompleto.*Nada foi alterado/);
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByRole('alert')).toHaveText(/não é um backup do app.*Nada foi alterado/);
  await semRolagemLateral(page);
  expect(await estadoDoBanco(page)).toEqual(antes);
  await expect(page.getByText('Cópia de antes da restauração')).toHaveCount(0);

  // O válido: mostra o que entra e o que será trocado; guarda a cópia e restaura.
  // O celular tem medida mais nova que o backup: aviso vermelho e 2ª confirmação, com o
  // "Não" no lugar do botão tocado (tocar duas vezes no mesmo lugar não restaura).
  await page.locator('input[type=file]').setInputFiles(caminho);
  await expect(page.getByRole('alert')).toHaveText(/dados que o backup não tem/);
  // Na tabela, a data deste celular (mais nova que a do backup) aparece em vermelho.
  const dados = page.getByRole('row', { name: /^Dados até/ });
  // Mesmo minuto do backup: a célula diz "mais novo" (senão as duas datas parecem iguais).
  await expect(dados.locator('td.mais')).toHaveText(/mais novo/);
  await semRolagemLateral(page);
  await expect(page.getByRole('columnheader', { name: 'Este celular' })).toBeVisible();
  const restaurar = page.getByRole('button', { name: 'Restaurar este backup' });
  await restaurar.scrollIntoViewIfNeeded(); // a prévia é mais alta que a tela
  // Toque de dedo no meio do botão; no mesmo ponto da tela agora tem que estar o "Não".
  const lugar = (await restaurar.boundingBox())!;
  const ponto = { x: lugar.x + lugar.width / 2, y: lugar.y + lugar.height / 2 };
  await page.touchscreen.tap(ponto.x, ponto.y);
  const nao = page.getByRole('button', { name: 'Não, manter os dados deste celular' });
  await expect(nao).toBeVisible();
  expect(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.textContent, ponto),
  ).toBe('Não, manter os dados deste celular');
  await page.getByRole('button', { name: 'Sim, trocar tudo pelo backup' }).click();
  await expect(page.getByText(/Backup restaurado/)).toBeVisible();
  const copia = page.locator('section', { hasText: 'Cópia de antes da restauração' });
  await expect(copia).toBeVisible();
  const baixada = await baixar(page, copia);
  expect(baixada.suggestedFilename()).toMatch(
    /^levantamento-backup-antes-de-restaurar-\d{4}-\d\d-\d\d-\d{4}\.json$/,
  );
  const daCopia = JSON.parse(readFileSync(await baixada.path(), 'utf8'));
  expect(daCopia.medicoes).toEqual(antes.medicoes); // a medida de 999 está na cópia

  await page.getByRole('link', { name: 'Ir para a lista' }).click();
  await abrirFicha(page, 'XA-TC-01');
  await expect(largura()).toHaveValue('660');

  // A cópia continua guardada no app depois de recarregar, e dá para voltar a ela.
  await page.goto('./#/restaurar');
  await page.reload();
  await page.getByRole('button', { name: 'Restaurar esta cópia' }).click();
  await expect(page.getByText('Tudo neste celular será trocado')).toBeVisible(); // sem risco: sem 2º passo
  await page.getByRole('button', { name: 'Restaurar este backup' }).click();
  await expect(page.getByText(/Backup restaurado/)).toBeVisible();
  expect(await estadoDoBanco(page)).toEqual(antes); // o 999 voltou
  await expect(page.getByText('Cópias de antes das restaurações')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurar esta cópia' })).toHaveCount(2);
  await semRolagemLateral(page);
});

test('backup feito antes do croqui: depois de restaurar, os croquis aparecem sem trocar o PCM', async ({
  page,
  context,
}) => {
  // Campo, 27/10: o backup guarda a lista de itens. Restaurar um backup sem "MEDIDAS
  // EXTERNAS" (feito antes de trocar o PCM na versão nova) tirava os croquis do celular.
  await fichaOffline(page, context);
  const largura = () => cartao(page, 'TAPETE').getByRole('textbox', { name: 'Largura' });
  await largura().fill('660');
  await expect(page.getByText('Salvo no aparelho', { exact: true })).toBeVisible();
  await irParaBackup(page);
  await page.getByRole('button', { name: 'Preparar backup' }).click();
  const caminho = test.info().outputPath('backup.json');
  await (await baixar(page)).saveAs(caminho);

  const json = JSON.parse(readFileSync(caminho, 'utf8'));
  const itens = (json.itens as { nome: string }[]).filter((i) => i.nome !== 'MEDIDAS EXTERNAS');
  expect(json.itens.length - itens.length).toBe(9);
  json.itens = itens;
  json.resumo.itens = itens.length;
  const semCroqui = test.info().outputPath('backup-sem-croqui.json');
  writeFileSync(semCroqui, JSON.stringify(json));

  await page.getByRole('link', { name: 'Restaurar um backup' }).click();
  await page.locator('input[type=file]').setInputFiles(semCroqui);
  await page.getByRole('button', { name: 'Restaurar este backup' }).click();
  // Backup no mesmo segundo da medida: o celular parece "mais novo" e pede a 2ª confirmação.
  const sim = page.getByRole('button', { name: 'Sim, trocar tudo pelo backup' });
  const restaurado = page.getByText(/Backup restaurado/);
  await expect(restaurado.or(sim)).toBeVisible();
  if (await sim.isVisible()) await sim.click();
  await expect(restaurado).toBeVisible();
  await page.getByRole('link', { name: 'Ir para a lista' }).click();
  await abrirFicha(page, 'XB-AS-01');
  await expect(page.getByRole('tab', { selected: true })).toHaveText(/^Exterior/);
  await expect(page.getByRole('img', { name: 'Aeroseparador: cotas A a F' })).toBeVisible();
  await page.getByRole('link', { name: 'Lista', exact: true }).click();
  await abrirFicha(page, 'XA-TC-01');
  await expect(largura()).toHaveValue('660');
});

test('preparar o backup mostra a barra de progresso com as fotos feitas', async ({
  page,
  context,
}) => {
  // Deixa cada foto mais lenta para dar tempo de ver a barra andando.
  await context.addInitScript(() => {
    const ler = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (b) {
      setTimeout(() => ler.call(this, b), 400);
    };
  });
  await fichaOffline(page, context);
  await preencher(page);
  await irParaBackup(page);
  await page.getByRole('button', { name: 'Preparar backup' }).click();
  const barra = page.getByRole('progressbar');
  await expect(barra).toBeVisible();
  await expect(page.getByText(/^Preparando… \d de 2 fotos$/)).toBeVisible();
  await expect.poll(() => barra.getAttribute('aria-valuenow')).toBe('50');
  // Os outros arquivos esperam (um por vez).
  await expect(page.getByRole('button', { name: 'Preparar planilha' })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Baixar', exact: true })).toBeVisible();
  await expect(barra).toHaveCount(0);
  await semRolagemLateral(page);
});
