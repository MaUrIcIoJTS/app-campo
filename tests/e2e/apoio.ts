import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

export const FIXTURE = 'tests/fixtures/pcm-ficticio.xls';

export const linhas = (page: Page) => page.locator('.lista-eq > li');

/** Em quantas linhas o texto do elemento quebrou (conta as alturas distintas das linhas). */
export const linhasDoTexto = (alvo: Locator) =>
  alvo.evaluate((el) => {
    const faixa = document.createRange();
    faixa.selectNodeContents(el);
    return new Set([...faixa.getClientRects()].map((r) => Math.round(r.bottom))).size;
  });

/** Cartão de um item na ficha, pelo nome exato do item (a guia dele precisa estar aberta). */
export const cartao = (page: Page, item: string) =>
  page.locator('li.item').filter({ has: page.getByRole('heading', { name: item, exact: true }) });

/** Guia da ficha onde fica cada item dos equipamentos da fixture. */
const GUIA_DO_ITEM: Readonly<Record<string, string>> = {
  TAPETE: 'Correia',
  CORREIA: 'Correia',
  'TAMBOR 1': 'Tambores',
  'TAMBOR 2': 'Tambores',
  MANCAL: 'Tambores',
  ROLAMENTO: 'Tambores',
  BUCHA: 'Tambores',
  'ROLETE DE CARGA': 'Roletes',
  'ROLETE DE RETORNO': 'Roletes',
  REDUTOR: 'Acionamento',
  MOTOR: 'Acionamento',
  'POLIA DO MOTOR': 'Acionamento',
  'CORREIA EM V': 'Acionamento',
  'CHAVE DE SEGURANÇA': 'Outros',
  'MEDIDAS EXTERNAS': 'Exterior',
};

/** Botão de uma guia da ficha ("Tambores", "Fotos 3"…), pelo começo do nome. */
export const guia = (page: Page, nome: string) =>
  page.getByRole('tab', { name: new RegExp(`^${nome}`) });

/**
 * Abre uma guia da ficha. Clica pelo DOM: o click do Playwright num elemento preso no topo
 * (sticky) rola a página antes, o que um dedo não faz.
 */
export async function abrirGuia(page: Page, nome: string) {
  const botao = guia(page, nome);
  if ((await botao.getAttribute('aria-selected')) === 'true') return;
  await botao.evaluate((el: HTMLElement) => el.click());
  await expect(botao).toHaveAttribute('aria-selected', 'true');
}

/** Abre a guia onde fica o item e devolve o cartão dele. */
export async function noItem(page: Page, item: string): Promise<Locator> {
  const nome = GUIA_DO_ITEM[item];
  if (!nome) throw new Error(`Item sem guia conhecida: ${item}`);
  await abrirGuia(page, nome);
  return cartao(page, item);
}

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
  await page.getByRole('button', { name: 'Importar (15 equipamentos)' }).click();
  await expect(page.getByText('15 equipamentos', { exact: true })).toBeVisible();
}

export async function abrirFicha(page: Page, tag: string) {
  await linhas(page).filter({ hasText: tag }).click();
  await expect(page.getByRole('heading', { level: 1, name: tag })).toBeVisible();
}

/** App instalado, em modo avião, com o PCM importado e a ficha do XA-TC-01 aberta. */
export async function fichaOffline(page: Page, context: BrowserContext) {
  await page.goto('./');
  await esperarServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await importarFixture(page);
  await abrirFicha(page, 'XA-TC-01');
}

/** Abre o app de novo (offline) numa página nova e vai para a ficha do XA-TC-01. */
export async function reabrir(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('./');
  await expect(linhas(page)).toHaveCount(15);
  await abrirFicha(page, 'XA-TC-01');
  return page;
}

/**
 * JPEG "de câmera" gerado no navegador: quatro quadrantes de cor (vermelho, verde / azul,
 * amarelo) e ruído no meio para ter tamanho de foto real. `orientacao` grava a tag EXIF
 * Orientation (6 = celular em pé: a imagem está deitada e o EXIF manda girar 90° horário).
 */
export async function jpegDeCamera(
  page: Page,
  largura: number,
  altura: number,
  orientacao?: number,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      const cores = ['#d00000', '#00a000', '#0000d0', '#e0e000'];
      cores.forEach((cor, k) => {
        ctx.fillStyle = cor;
        ctx.fillRect((k % 2) * (w / 2), Math.floor(k / 2) * (h / 2), w / 2, h / 2);
      });
      for (let i = 0; i < (w * h) / 400; i++) {
        ctx.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`;
        ctx.fillRect(w * (0.25 + 0.5 * Math.random()), h * (0.25 + 0.5 * Math.random()), 6, 6);
      }
      const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.95));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [largura, altura] as const,
  );
  const jpeg = Buffer.from(base64, 'base64');
  return orientacao ? comOrientacaoExif(jpeg, orientacao) : jpeg;
}

/** Insere um bloco EXIF (APP1) só com a tag Orientation logo depois do início do JPEG. */
function comOrientacaoExif(jpeg: Buffer, orientacao: number): Buffer {
  // TIFF big-endian: cabeçalho, IFD0 com 1 entrada (0x0112 Orientation, SHORT, 1 valor).
  const tiff = Buffer.from([
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientacao,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const tamanho = exif.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, tamanho >> 8, tamanho & 0xff]), exif]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

export interface FotoGravada {
  alvoId: string;
  tipo: string;
  bytes: number;
  largura: number;
  altura: number;
  /** Tamanho real do JPEG gravado (decodificado de novo). */
  real: [number, number];
  miniatura: [number, number] | null;
  daPlaca: boolean;
  /** Cor [r, g, b] perto do canto de cima à esquerda (confere a orientação). */
  canto: [number, number, number];
}

/** O que está no store `fotos` do IndexedDB, lido direto (sem passar pelo app). */
export function fotosNoBanco(page: Page): Promise<FotoGravada[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('levantamento-pcm');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const fotos = await new Promise<
      {
        alvoId: string;
        blob: Blob;
        miniatura?: Blob;
        largura: number;
        altura: number;
        daPlaca?: boolean;
      }[]
    >((ok) => {
      const req = db.transaction('fotos').objectStore('fotos').getAll();
      req.onsuccess = () => ok(req.result);
    });
    db.close();
    return Promise.all(
      fotos.map(async (f) => {
        const img = await createImageBitmap(f.blob);
        const mini = f.miniatura ? await createImageBitmap(f.miniatura) : null;
        const c = new OffscreenCanvas(1, 1).getContext('2d')!;
        c.drawImage(img, img.width * 0.05, img.height * 0.05, 1, 1, 0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = c.getImageData(0, 0, 1, 1).data;
        return {
          alvoId: f.alvoId,
          tipo: f.blob.type,
          bytes: f.blob.size,
          largura: f.largura,
          altura: f.altura,
          real: [img.width, img.height] as [number, number],
          miniatura: mini ? ([mini.width, mini.height] as [number, number]) : null,
          daPlaca: !!f.daPlaca,
          canto: [r, g, b] as [number, number, number],
        };
      }),
    );
  });
}
