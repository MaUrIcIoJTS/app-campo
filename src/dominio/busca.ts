import { normalizar } from './texto.ts';

interface Pesquisavel {
  tag: string | null;
  nomeOriginal: string;
  aba: string;
}

const compactar = (s: string) => s.replace(/[^A-Z0-9]/g, '');

/**
 * Filtra por aba e por texto. Cada palavra digitada precisa aparecer (em qualquer ordem),
 * sem diferença de acento/maiúscula; "tc04" também acha "TC-04" (ignora hífen e espaço).
 */
export function filtrarEquipamentos<T extends Pesquisavel>(
  lista: readonly T[],
  termo: string,
  aba = '',
): T[] {
  const palavras = normalizar(termo).split(' ').filter(Boolean);
  return lista.filter((e) => {
    if (aba && e.aba !== aba) return false;
    if (palavras.length === 0) return true;
    const alvo = normalizar(`${e.tag ?? ''} ${e.nomeOriginal}`);
    const alvoCompacto = compactar(alvo);
    return palavras.every((p) => alvo.includes(p) || alvoCompacto.includes(compactar(p)));
  });
}

/**
 * Próximo equipamento na ordem do PCM. Com a lista filtrada por aba (e o atual nela), fica
 * dentro da aba: no último da aba, não há próximo. A busca por texto não conta (serve para
 * achar um equipamento, não para delimitar o percurso).
 */
export function proximoEquipamento<T extends { id: string; aba: string }>(
  lista: readonly T[],
  atualId: string,
  abaFiltrada = '',
): T | null {
  const k = lista.findIndex((e) => e.id === atualId);
  if (k < 0) return null;
  const proximo = lista[k + 1] ?? null;
  const dentroDaAba = abaFiltrada !== '' && lista[k]!.aba === abaFiltrada;
  return proximo && dentroDaAba && proximo.aba !== abaFiltrada ? null : proximo;
}
