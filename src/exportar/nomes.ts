/** Nomes dos arquivos exportados e das fotos dentro do .zip (puro). */
import { emOrdem } from '../dominio/fotos.ts';
import { normalizar } from '../dominio/texto.ts';

const dois = (n: number) => String(n).padStart(2, '0');

/** `AAAA-MM-DD-HHmm`, hora local. */
export function carimboDeArquivo(d: Date): string {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}`;
}

export const nomeDaPlanilha = (d: Date) => `pcm-atualizado-${carimboDeArquivo(d)}.xlsx`;
export const nomeDoBackup = (d: Date) => `levantamento-backup-${carimboDeArquivo(d)}.json`;
export const nomeDaCopiaAutomatica = (d: Date) =>
  `levantamento-backup-antes-de-restaurar-${carimboDeArquivo(d)}.json`;
export const nomeDoZip = (d: Date) => `fotos-${carimboDeArquivo(d)}.zip`;

export const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  json: 'application/json',
  zip: 'application/zip',
} as const;

/** Só `A–Z 0–9 -`, maiúsculo, sem acento; espaços e símbolos viram `-`. */
export function parteDoNome(texto: string, max = 30): string {
  const s = normalizar(texto)
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.slice(0, max).replace(/-+$/, '') || 'SEM-NOME';
}

interface EquipamentoDoNome {
  id: string;
  tag: string | null;
  nome: string;
}
interface ItemDoNome {
  id: string;
  equipamentoId: string;
  nome: string;
}
interface FotoDoNome {
  id: string;
  alvoId: string;
  criadaEm: string;
  daPlaca?: boolean;
}

/**
 * `<TAG>_<ITEM>_<n>.jpg` (ex.: `XA-TC-01_MOTOR_1.jpg`); foto do equipamento: `_GERAL_`;
 * da placa: `_MOTOR_PLACA_1`. Sem TAG: nome do equipamento (até 30 caracteres). `n` começa em
 * 1 para cada nome e segue a ordem em que as fotos foram tiradas — nunca dois nomes iguais.
 * Devolve id da foto → nome.
 */
export function nomesDasFotos(
  fotos: readonly FotoDoNome[],
  equipamentos: readonly EquipamentoDoNome[],
  itens: readonly ItemDoNome[],
): Map<string, string> {
  const eqs = new Map(equipamentos.map((e) => [e.id, e]));
  const its = new Map(itens.map((i) => [i.id, i]));
  const contagem = new Map<string, number>();
  const nomes = new Map<string, string>();
  for (const f of emOrdem(fotos)) {
    const item = its.get(f.alvoId);
    const eq = eqs.get(item ? item.equipamentoId : f.alvoId);
    const equipamento = eq ? (eq.tag ? parteDoNome(eq.tag, 40) : parteDoNome(eq.nome)) : 'SEM-ITEM';
    const alvo = item ? parteDoNome(item.nome) : eq ? 'GERAL' : 'FOTO';
    const base = `${equipamento}_${alvo}${f.daPlaca ? '_PLACA' : ''}`;
    const n = (contagem.get(base) ?? 0) + 1;
    contagem.set(base, n);
    nomes.set(f.id, `${base}_${n}.jpg`);
  }
  return nomes;
}
