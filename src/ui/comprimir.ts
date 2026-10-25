/**
 * Comprime a foto da câmera antes de gravar: respeita a orientação (EXIF), reduz para no
 * máximo 1600 px no maior lado e grava JPEG 0,8 — mais uma miniatura de 320 px para o cartão.
 * Uma foto de 12 MP (3–5 MB) vira ~300–500 KB.
 */
import {
  dimensoesReduzidas,
  LADO_MAXIMO,
  LADO_MINIATURA,
  QUALIDADE_JPEG,
  QUALIDADE_MINIATURA,
} from '../dominio/fotos.ts';

/** O arquivo não é uma imagem que o navegador consiga abrir (ex.: HEIC da galeria). */
export class FotoIlegivel extends Error {
  constructor(causa?: unknown) {
    super('Não consegui abrir a imagem.', { cause: causa });
    this.name = 'FotoIlegivel';
  }
}

export interface FotoComprimida {
  blob: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
}

interface Decodificada {
  fonte: CanvasImageSource;
  largura: number;
  altura: number;
  liberar: () => void;
}

async function decodificar(arquivo: Blob): Promise<Decodificada> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      return { fonte: b, largura: b.width, altura: b.height, liberar: () => b.close() };
    } catch (e) {
      console.warn('createImageBitmap falhou; tentando com <img>', e);
    }
  }
  // Alternativa: <img> também aplica a orientação EXIF nos navegadores atuais.
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new FotoIlegivel(e);
  }
  return {
    fonte: img,
    largura: img.naturalWidth,
    altura: img.naturalHeight,
    liberar: () => URL.revokeObjectURL(url),
  };
}

function desenhar(fonte: CanvasImageSource, largura: number, altura: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.fillStyle = '#fff'; // PNG com transparência não fica preto no JPEG
  ctx.fillRect(0, 0, largura, altura);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fonte, 0, 0, largura, altura);
  return canvas;
}

function paraJpeg(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((ok, falha) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : falha(new Error('Não consegui gerar o JPEG'))),
      'image/jpeg',
      qualidade,
    ),
  );
}

/** Solta a memória do canvas na hora (celular fraco). */
const liberarCanvas = (c: HTMLCanvasElement) => {
  c.width = 0;
  c.height = 0;
};

export async function comprimirFoto(arquivo: Blob): Promise<FotoComprimida> {
  const img = await decodificar(arquivo);
  let grande: HTMLCanvasElement;
  try {
    if (!(img.largura > 0 && img.altura > 0)) throw new FotoIlegivel();
    const d = dimensoesReduzidas(img.largura, img.altura, LADO_MAXIMO);
    grande = desenhar(img.fonte, d.largura, d.altura);
  } finally {
    img.liberar(); // a foto original (até 50 MP) sai da memória antes de gerar os JPEGs
  }
  try {
    const m = dimensoesReduzidas(grande.width, grande.height, LADO_MINIATURA);
    const pequeno = desenhar(grande, m.largura, m.altura);
    const [blob, miniatura] = await Promise.all([
      paraJpeg(grande, QUALIDADE_JPEG),
      paraJpeg(pequeno, QUALIDADE_MINIATURA).finally(() => liberarCanvas(pequeno)),
    ]);
    return { blob, miniatura, largura: grande.width, altura: grande.height };
  } finally {
    liberarCanvas(grande);
  }
}
