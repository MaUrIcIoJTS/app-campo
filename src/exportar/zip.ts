/**
 * Zip sem compressão (STORE) das fotos. As fotos já são JPEG comprimido: recomprimir só
 * gastaria bateria. Feito à mão (~100 linhas) em vez do JSZip porque o JSZip monta o zip
 * inteiro na memória (~200 MB num dia de campo); aqui os blobs das fotos entram no Blob final
 * por referência e cada um é lido uma vez só, para o CRC-32.
 *
 * Formato: PKZIP clássico (sem ZIP64) — até 65 535 arquivos e 4 GB, muito além de um dia de campo.
 */
import { MIME } from './nomes.ts';

export interface ArquivoDoZip {
  nome: string;
  blob: Blob;
  data: Date;
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

/** Data e hora no formato do MS-DOS (hora local, resolução de 2 s; mínimo 1980). */
function dataDos(d: Date): { hora: number; data: number } {
  const ano = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8 = 0x0800; // nomes em UTF-8

/**
 * Gera o .zip. `aoProgredir` é chamado a cada arquivo processado. Lança erro se passar dos
 * limites do formato clássico.
 */
export async function gerarZip(
  arquivos: readonly ArquivoDoZip[],
  aoProgredir?: (feitos: number, total: number) => void,
): Promise<Blob> {
  if (arquivos.length > 0xffff) throw new Error('Arquivos demais para um .zip');
  const codificador = new TextEncoder();
  const partes: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let posicao = 0;
  aoProgredir?.(0, arquivos.length);

  for (const [k, a] of arquivos.entries()) {
    const nome = codificador.encode(a.nome);
    const tamanho = a.blob.size;
    const crc = crc32(new Uint8Array(await a.blob.arrayBuffer()));
    const { hora, data } = dataDos(a.data);
    if (posicao + 30 + nome.length + tamanho > 0xffffffff)
      throw new Error('Fotos demais para um .zip (passa de 4 GB)');

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 10, true); // versão necessária: 1.0 (STORE)
    local.setUint16(6, UTF8, true);
    local.setUint16(8, 0, true); // método: STORE
    local.setUint16(10, hora, true);
    local.setUint16(12, data, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, tamanho, true);
    local.setUint32(22, tamanho, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);
    partes.push(local.buffer, nome as BlobPart, a.blob);

    const c = new DataView(new ArrayBuffer(46 + nome.length));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // feito por: versão 2.0
    c.setUint16(6, 10, true);
    c.setUint16(8, UTF8, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, data, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, tamanho, true);
    c.setUint32(24, tamanho, true);
    c.setUint16(28, nome.length, true);
    // extra, comentário, disco, atributos internos e externos: 0
    c.setUint32(42, posicao, true);
    new Uint8Array(c.buffer).set(nome, 46);
    central.push(new Uint8Array(c.buffer));

    posicao += 30 + nome.length + tamanho;
    aoProgredir?.(k + 1, arquivos.length);
  }

  const tamanhoCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, posicao, true);
  return new Blob([...partes, ...(central as BlobPart[]), fim.buffer], { type: MIME.zip });
}
