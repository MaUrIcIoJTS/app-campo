import type { Medicao } from '../db/esquema.ts';
import { TEMPLATES } from './templates/registro.ts';
import type { TipoItem } from './tipos.ts';

export interface Progresso {
  preenchidos: number;
  total: number;
  divergencias: number;
}

const VAZIO: Progresso = { preenchidos: 0, total: 0, divergencias: 0 };

/** Campo conta como feito se tem valor OU foi marcado ✓/✗ (conferido sem digitar). */
export function progressoItem(item: { tipo: TipoItem }, medicao?: Medicao): Progresso {
  const campos = TEMPLATES[item.tipo].campos;
  if (!medicao) return { ...VAZIO, total: campos.length };
  const feito = (id: string) =>
    (medicao.valores[id] ?? '').trim() !== '' || medicao.conferencia[id] !== undefined;
  return {
    preenchidos: campos.filter((c) => feito(c.id)).length,
    total: campos.length,
    divergencias: campos.filter((c) => medicao.conferencia[c.id] === 'diverge').length,
  };
}

export function somarProgresso(lista: readonly Progresso[]): Progresso {
  return lista.reduce(
    (s, p) => ({
      preenchidos: s.preenchidos + p.preenchidos,
      total: s.total + p.total,
      divergencias: s.divergencias + p.divergencias,
    }),
    VAZIO,
  );
}

export function percentual(p: Progresso): number {
  return p.total === 0 ? 0 : Math.floor((100 * p.preenchidos) / p.total);
}
