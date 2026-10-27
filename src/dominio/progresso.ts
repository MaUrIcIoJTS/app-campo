import type { Medicao } from '../db/esquema.ts';
import { chavePerimetro } from './croqui.ts';
import { TEMPLATES, type CampoTemplate } from './templates/registro.ts';
import type { TipoItem } from './tipos.ts';

export interface Progresso {
  preenchidos: number;
  total: number;
  divergencias: number;
}

const VAZIO: Progresso = { preenchidos: 0, total: 0, divergencias: 0 };

/**
 * Campo conta como feito se tem valor OU foi marcado ✓/✗/"não tem" (conferido sem digitar).
 * No croqui, o Ø medido pelo perímetro também conta.
 */
export function progressoItem(item: { tipo: TipoItem }, medicao?: Medicao): Progresso {
  const campos = TEMPLATES[item.tipo].campos;
  if (!medicao) return { ...VAZIO, total: campos.length };
  const temTexto = (chave: string) => (medicao.valores[chave] ?? '').trim() !== '';
  const feito = (c: CampoTemplate) =>
    temTexto(c.id) ||
    medicao.conferencia[c.id] !== undefined ||
    (!!c.perimetro && temTexto(chavePerimetro(c.id)));
  return {
    preenchidos: campos.filter(feito).length,
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
