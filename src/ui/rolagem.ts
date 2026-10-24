/**
 * Onde o técnico parou em cada ficha (sessionStorage: sobrevive ao Android recarregar a aba,
 * ex.: depois da câmera). Voltar da lista para a ficha cai no mesmo item, não no topo.
 */
const CHAVE = 'rolagem-fichas';

function ler(): Record<string, number> {
  try {
    const r: unknown = JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}');
    return typeof r === 'object' && r !== null ? (r as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function gravar(r: Record<string, number>): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(r));
  } catch {
    // sem sessionStorage: só não lembra a posição
  }
}

export const rolagemDaFicha = (id: string): number => ler()[id] ?? 0;

export function guardarRolagem(id: string, y: number): void {
  gravar({ ...ler(), [id]: Math.round(y) });
}

/** "Próximo equipamento" começa a ficha do início. */
export function esquecerRolagem(id: string): void {
  const r = ler();
  delete r[id];
  gravar(r);
}
