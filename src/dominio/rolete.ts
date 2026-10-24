import { parseNumero } from './numeros.ts';

/**
 * Código de rolete do PCM: `A x B x C x D x E`
 *   A = comprimento do tubo, B = comprimento total do eixo, C = Ø do tubo,
 *   D = fresado (medida entre as faces planas da ponta do eixo), E = Ø do eixo.
 *
 * Na planilha os dois últimos aparecem nas duas ordens (`…x14x20` e `…X20X14`):
 * o menor é sempre o fresado e o maior o Ø do eixo.
 */
export interface CodigoRolete {
  comprimentoTubo: number;
  comprimentoEixo: number;
  diametroTubo: number;
  fresado: number;
  diametroEixo: number;
}

export function parseCodigoRolete(texto: string): CodigoRolete | null {
  const partes = texto
    .trim()
    .split(/\s*[xX×*]\s*/)
    .map((p) => parseNumero(p));
  if (partes.length !== 5 || partes.some((p) => p === null)) return null;
  const [a, b, c, d, e] = partes as [number, number, number, number, number];
  return {
    comprimentoTubo: a,
    comprimentoEixo: b,
    diametroTubo: c,
    fresado: Math.min(d, e),
    diametroEixo: Math.max(d, e),
  };
}
