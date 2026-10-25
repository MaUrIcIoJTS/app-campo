/**
 * Backup completo (.json): PCM importado (com o arquivo original), medições, notas e fotos
 * (blob e miniatura em base64). Formato descrito na skill `exportar-pcm`.
 *
 * Memória: um dia de campo tem 300–400 fotos (~200 MB; em base64, ~270 MB). O arquivo NUNCA
 * vira uma string só: cada foto é convertida, embrulhada num Blob pequeno e a string é
 * descartada; o Blob final só referencia os pedaços (o navegador guarda em disco o que não
 * couber na memória). Na memória fica no máximo uma foto por vez.
 */
import type { TudoDoBanco } from '../db/repositorio.ts';
import { emOrdem } from '../dominio/fotos.ts';
import { blobParaBase64 } from './base64.ts';
import { MIME } from './nomes.ts';
import { isoLocal } from './textos.ts';

export const FORMATO_BACKUP = 'levantamento-pcm-backup';
/** Versão do FORMATO do backup (não do app). Mudou o formato → nova versão + leitura da antiga. */
export const VERSAO_BACKUP = 1;

export interface ResumoBackup {
  importacoes: number;
  equipamentos: number;
  itens: number;
  medicoes: number;
  notas: number;
  fotos: number;
}

export const resumir = (t: TudoDoBanco): ResumoBackup => ({
  importacoes: t.importacoes.length,
  equipamentos: t.equipamentos.length,
  itens: t.itens.length,
  medicoes: t.medicoes.length,
  notas: t.notas.length,
  fotos: t.fotos.length,
});

interface Opcoes {
  criadoEm: Date;
  esquemaDb: number;
  app: string;
  /** Chamado a cada foto convertida. */
  aoProgredir?: (feitas: number, total: number) => void;
}

/** Lista JSON com um registro por linha. */
const lista = (registros: readonly unknown[]) =>
  registros.length === 0 ? '[]' : `[\n${registros.map((r) => JSON.stringify(r)).join(',\n')}\n]`;

/** Objeto JSON sem o `}` do fim, para acrescentar campos grandes em pedaços. */
const semFechar = (obj: object) => JSON.stringify(obj).slice(0, -1);

export async function gerarBackup(t: TudoDoBanco, opcoes: Opcoes): Promise<Blob> {
  const partes: BlobPart[] = [];
  const cabecalho = {
    formato: FORMATO_BACKUP,
    versao: VERSAO_BACKUP,
    criadoEm: isoLocal(opcoes.criadoEm),
    esquemaDb: opcoes.esquemaDb,
    app: opcoes.app,
    resumo: resumir(t),
    importacaoAtual: t.importacaoAtual,
  };
  partes.push(semFechar(cabecalho));

  partes.push(',\n"importacoes":[');
  for (const [k, { arquivo, ...resto }] of t.importacoes.entries()) {
    const base64 = await blobParaBase64(arquivo);
    partes.push(
      new Blob([
        k ? ',\n' : '\n',
        semFechar({ ...resto, tipo: arquivo.type }),
        ',"arquivoBase64":"',
        base64,
        '"}',
      ]),
    );
  }
  partes.push(t.importacoes.length ? '\n]' : ']');

  partes.push(',\n"equipamentos":', lista(t.equipamentos));
  partes.push(',\n"itens":', lista(t.itens));
  partes.push(',\n"medicoes":', lista(t.medicoes));
  partes.push(',\n"notas":', lista(t.notas));

  // Fotos por último (a parte pesada), uma por linha, na ordem em que foram tiradas.
  partes.push(',\n"fotos":[');
  const fotos = emOrdem(t.fotos);
  opcoes.aoProgredir?.(0, fotos.length);
  for (const [k, { blob, miniatura, ...resto }] of fotos.entries()) {
    const base64 = await blobParaBase64(blob);
    const pedaco: BlobPart[] = [
      k ? ',\n' : '\n',
      semFechar({
        ...resto,
        tipo: blob.type || 'image/jpeg',
        ...(miniatura && { miniaturaTipo: miniatura.type || 'image/jpeg' }),
      }),
      ',"base64":"',
      base64,
      '"',
    ];
    if (miniatura) pedaco.push(',"miniaturaBase64":"', await blobParaBase64(miniatura), '"');
    pedaco.push('}');
    partes.push(new Blob(pedaco));
    opcoes.aoProgredir?.(k + 1, fotos.length);
  }
  partes.push(fotos.length ? '\n]}\n' : ']}\n');

  return new Blob(partes, { type: MIME.json });
}
