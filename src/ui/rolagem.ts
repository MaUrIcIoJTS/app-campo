/**
 * Onde o técnico parou em cada ficha (sessionStorage: sobrevive ao Android recarregar a aba,
 * ex.: depois da câmera): a guia aberta e a rolagem. Voltar da lista para a ficha cai na
 * mesma guia e no mesmo item, não no topo.
 */
const CHAVE = 'rolagem-fichas';
const CHAVE_GUIA = 'guia-fichas';
/** Onde parou em cada guia de cada ficha: voltar a uma guia cai no mesmo item. */
const CHAVE_POR_GUIA = 'rolagem-guias';

function ler<T>(chave: string): Record<string, T> {
  try {
    const r: unknown = JSON.parse(sessionStorage.getItem(chave) ?? '{}');
    return typeof r === 'object' && r !== null ? (r as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function gravar(chave: string, r: Record<string, unknown>): void {
  try {
    sessionStorage.setItem(chave, JSON.stringify(r));
  } catch {
    // sem sessionStorage: só não lembra a posição
  }
}

export const rolagemDaFicha = (id: string): number => ler<number>(CHAVE)[id] ?? 0;

export function guardarRolagem(id: string, y: number): void {
  gravar(CHAVE, { ...ler(CHAVE), [id]: Math.round(y) });
}

export const guiaDaFicha = (id: string): string | null => ler<string>(CHAVE_GUIA)[id] ?? null;

export function guardarGuia(id: string, guia: string): void {
  gravar(CHAVE_GUIA, { ...ler(CHAVE_GUIA), [id]: guia });
}

export const rolagemDaGuia = (id: string, guia: string): number | null =>
  ler<number>(CHAVE_POR_GUIA)[`${id}#${guia}`] ?? null;

export function guardarRolagemDaGuia(id: string, guia: string, y: number): void {
  gravar(CHAVE_POR_GUIA, { ...ler(CHAVE_POR_GUIA), [`${id}#${guia}`]: Math.round(y) });
}

/** "Próximo equipamento" começa a ficha do início (na primeira guia). */
export function esquecerRolagem(id: string): void {
  for (const chave of [CHAVE, CHAVE_GUIA]) {
    const r = ler(chave);
    delete r[id];
    gravar(chave, r);
  }
  const porGuia = ler<number>(CHAVE_POR_GUIA);
  for (const k of Object.keys(porGuia)) if (k.startsWith(`${id}#`)) delete porGuia[k];
  gravar(CHAVE_POR_GUIA, porGuia);
}
