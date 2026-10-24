/** Conversões numéricas usadas em campo: vírgula decimal, polegadas e diferença (Δ). */

export const MM_POR_POLEGADA = 25.4;

/**
 * Lê um número digitado no celular ou vindo do PCM.
 * Aceita vírgula ou ponto decimal ("38,14", "38.14"). Com os dois presentes,
 * o ponto é separador de milhar ("1.234,5"). Ignora espaços e unidade no fim ("63 mm").
 */
export function parseNumero(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  if (texto == null) return null;
  let s = String(texto).trim().replace(/\s+/g, '');
  const m = s.match(/^[-+]?[\d.,]+/);
  if (!m) return null;
  s = m[0];
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lê uma medida em polegadas: `26"`, `3/16`, `1 1/2"`, `1/4"`, `2.5`.
 * Retorna o valor em polegadas (não converte).
 */
export function parsePolegadas(texto: string): number | null {
  const s = texto
    .trim()
    .replace(/["”″]|pol\.?$/gi, '')
    .trim();
  const misto = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (misto) return Number(misto[1]) + Number(misto[2]) / Number(misto[3]);
  const fracao = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracao) return Number(fracao[2]) === 0 ? null : Number(fracao[1]) / Number(fracao[2]);
  return parseNumero(s);
}

export function polegadasParaMm(polegadas: number): number {
  return arredondar(polegadas * MM_POR_POLEGADA, 2);
}

/**
 * Medida DIGITADA pelo técnico: estrita — só um número, com vírgula ou ponto decimal.
 * Diferente de `parseNumero` (tolerante, para o texto do PCM): "65O" aqui é inválido.
 */
export function parseMedida(texto: string | null | undefined): number | null {
  const s = (texto ?? '').trim();
  if (!/^[-+]?(\d+([.,]\d+)?|[.,]\d+)$/.test(s)) return null;
  return Number(s.replace(',', '.'));
}

/** "12.450": ponto + 3 casas pode ser milhar (12450) ou decimal (12,45). Avisar, não adivinhar. */
export function medidaAmbigua(texto: string | null | undefined): boolean {
  return /^[-+]?[1-9]\d{0,2}\.\d{3}$/.test((texto ?? '').trim());
}

/** Δ = medido − PCM. Só existe quando os dois lados são números. */
export function calcularDelta(
  medido: string | number | null | undefined,
  pcm: string | number | null | undefined,
): number | null {
  const a = parseNumero(medido);
  const b = parseNumero(pcm);
  if (a === null || b === null) return null;
  return arredondar(a - b, 3);
}

export function arredondar(n: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

/** Formata para exibir em pt-BR: vírgula decimal, sem zeros inúteis. */
export function formatarNumero(n: number, casasMax = 2): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: casasMax, useGrouping: false });
}

/** Formata o Δ sempre com sinal: "+2", "−0,5", "0". */
export function formatarDelta(delta: number): string {
  if (delta === 0) return '0';
  const s = formatarNumero(Math.abs(delta));
  return delta > 0 ? `+${s}` : `−${s}`;
}
