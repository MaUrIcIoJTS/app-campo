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
