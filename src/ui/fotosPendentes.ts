/**
 * Fotos esperadas que ainda não estão no banco, anotadas em localStorage (sobrevive ao
 * Android matar a aba com a câmera aberta e ao técnico fechar o app no meio da gravação).
 *
 * - Tocou em "Tirar foto"/"Galeria": uma entrada `camera` (a foto ainda vai chegar).
 * - A foto chegou: uma entrada `foto` por arquivo, riscada só quando o banco confirmar
 *   (ou quando o técnico dispensar o aviso de falha). A `camera` é riscada na mesma hora.
 * - Cancelou a câmera: risca a `camera`.
 *
 * Ao abrir o app, o que sobrou são fotos perdidas: o cartão do item avisa quantas.
 */
import type { Armazenamento } from '../db/diario.ts';

const CHAVE = 'fotos-pendentes';
/** Câmera aberta há mais que isto não é desta sessão (o técnico saiu e voltou depois). */
const VALIDADE_CAMERA_MS = 15 * 60 * 1000;
const VALIDADE_FOTO_MS = 24 * 60 * 60 * 1000;

export interface Pendencia {
  id: string;
  /** Seção de fotos do cartão (`secaoDe`). */
  secao: string;
  equipamentoId: string;
  tipo: 'camera' | 'foto';
  em: number;
}

export interface FotosPerdidas {
  n: number;
  equipamentoId: string;
}

function local(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function ler(area: Armazenamento | null): Pendencia[] {
  try {
    const r: unknown = JSON.parse(area?.getItem(CHAVE) ?? '[]');
    return Array.isArray(r)
      ? r.filter(
          (p): p is Pendencia =>
            typeof p === 'object' &&
            p !== null &&
            typeof p.id === 'string' &&
            typeof p.secao === 'string' &&
            typeof p.equipamentoId === 'string' &&
            (p.tipo === 'camera' || p.tipo === 'foto') &&
            typeof p.em === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

function gravar(area: Armazenamento | null, lista: Pendencia[]): void {
  try {
    if (lista.length === 0) area?.removeItem(CHAVE);
    else area?.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // sem localStorage: só não avisa se o app fechar antes de gravar a foto
  }
}

let sequencia = 0;

export function anotarPendencia(
  p: Omit<Pendencia, 'id' | 'em'>,
  area = local(),
  agora = Date.now(),
): string {
  const id = `${agora.toString(36)}-${(sequencia++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  gravar(area, [...ler(area), { ...p, id, em: agora }]);
  return id;
}

export function riscarPendencias(ids: readonly string[], area = local()): void {
  if (ids.length === 0) return;
  const fora = new Set(ids);
  const antes = ler(area);
  const depois = antes.filter((p) => !fora.has(p.id));
  if (depois.length !== antes.length) gravar(area, depois);
}

/**
 * Ao abrir o app: fotos que ficaram pendentes (o app fechou antes de gravá-las), por seção.
 * Lê e limpa (avisa uma vez só).
 */
export function fotosPerdidasAoAbrir(
  area = local(),
  agora = Date.now(),
): Map<string, FotosPerdidas> {
  const lista = ler(area);
  gravar(area, []);
  const saida = new Map<string, FotosPerdidas>();
  for (const p of lista) {
    const idade = agora - p.em;
    const validade = p.tipo === 'camera' ? VALIDADE_CAMERA_MS : VALIDADE_FOTO_MS;
    if (idade < 0 || idade >= validade) continue;
    const atual = saida.get(p.secao);
    saida.set(p.secao, { n: (atual?.n ?? 0) + 1, equipamentoId: p.equipamentoId });
  }
  return saida;
}
