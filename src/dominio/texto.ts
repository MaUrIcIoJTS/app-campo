/** Normalização de texto da planilha: espaços repetidos, quebras de linha, acentos. */

export function limpar(texto: unknown): string {
  return String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Maiúsculas, sem acento e com espaços normalizados — para comparar e detectar. */
export function normalizar(texto: unknown): string {
  return limpar(texto).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

/** Identificador estável e legível: "MICROPULVERIZADOR 1" → "micropulverizador-1". */
export function slug(texto: unknown): string {
  return normalizar(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
