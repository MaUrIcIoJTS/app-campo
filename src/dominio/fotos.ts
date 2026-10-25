/** Regras puras das fotos: tamanho final, espaço que sobra no celular, ids. */

/** Maior lado da foto gravada (px). Lê-se uma placa de motor e não estoura o espaço. */
export const LADO_MAXIMO = 1600;
export const QUALIDADE_JPEG = 0.8;
/** Miniatura do cartão (px): leve para a ficha não pesar na memória do celular. */
export const LADO_MINIATURA = 320;
export const QUALIDADE_MINIATURA = 0.7;
/** Tamanho típico de uma foto gravada (1600 px, JPEG 0,8 + miniatura), para estimar espaço. */
export const TAMANHO_TIPICO_FOTO = 500_000;

/** Reduz para caber em `max` no maior lado, mantendo a proporção. Nunca aumenta. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  max: number,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const escala = max / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

export type NivelEspaco = 'ok' | 'pouco' | 'cheio';

export interface SituacaoEspaco {
  /** Quantas fotos ainda cabem, pela estimativa do navegador. */
  fotosQueCabem: number;
  nivel: NivelEspaco;
}

/** Abaixo disto avisa "pouco espaço" (um dia de campo tira umas 200–400 fotos). */
const FOTOS_POUCO = 200;
const FOTOS_CHEIO = 30;

/**
 * Situação do espaço a partir de `navigator.storage.estimate()`. Sem números (navegador
 * não informa), devolve null: o erro de cota ao gravar continua sendo tratado.
 */
export function situacaoEspaco(estimativa: {
  usage?: number;
  quota?: number;
}): SituacaoEspaco | null {
  const { usage, quota } = estimativa;
  if (typeof usage !== 'number' || typeof quota !== 'number' || !(quota > 0)) return null;
  const fotosQueCabem = Math.max(0, Math.floor((quota - usage) / TAMANHO_TIPICO_FOTO));
  const nivel =
    fotosQueCabem < FOTOS_CHEIO ? 'cheio' : fotosQueCabem < FOTOS_POUCO ? 'pouco' : 'ok';
  return { fotosQueCabem, nivel };
}

/** Aviso curto para a ficha; null quando há espaço de sobra. */
export function avisoDeEspaco(s: SituacaoEspaco | null): string | null {
  if (!s || s.nivel === 'ok') return null;
  const cabem = s.fotosQueCabem === 1 ? 'cabe ~1 foto' : `cabem ~${s.fotosQueCabem} fotos`;
  return s.nivel === 'cheio'
    ? `Celular quase sem espaço: ${cabem}. Libere espaço no celular.`
    : `Pouco espaço no celular: ${cabem}.`;
}

/** Id único de foto (ordena pela hora em que foi tirada). */
export function idNovaFoto(agora = Date.now(), sorteio = Math.random()): string {
  return `foto-${agora.toString(36)}-${Math.floor(sorteio * 36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;
}

/** Fotos na ordem em que foram tiradas. */
export function emOrdem<T extends { criadaEm: string; id: string }>(fotos: readonly T[]): T[] {
  return [...fotos].sort((a, b) =>
    a.criadaEm === b.criadaEm ? (a.id < b.id ? -1 : 1) : a.criadaEm < b.criadaEm ? -1 : 1,
  );
}
