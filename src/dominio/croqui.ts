/**
 * Croqui das medidas externas: o corpo do equipamento (aeroseparador, silo…) com as cotas por
 * letra. Não está no PCM: o app deduz um item "MEDIDAS EXTERNAS" pela categoria do equipamento
 * (1ª palavra do nome), como deduz os tambores pelos mancais.
 *
 * "Sem acesso" e "estimado" ficam no próprio texto digitado ("sem acesso", "≈ 1800"): nada muda
 * no banco nem no backup, e a planilha sai legível.
 */
import type { Conferencia } from '../db/esquema.ts';
import { parseMedida } from './numeros.ts';
import { normalizar } from './texto.ts';
import type { EquipamentoPcm, ItemPcm, TipoItem } from './tipos.ts';

export const NOME_DO_CROQUI = 'MEDIDAS EXTERNAS';

/** Categoria (1ª palavra do nome do equipamento) → formato do croqui. */
const FORMATO_DA_CATEGORIA: ReadonlyArray<readonly [RegExp, TipoItem]> = [
  [/^(AERO ?SEPARADOR|SEPARADOR)\b/, 'corpo-aeroseparador'],
  [/^SILO\b/, 'corpo-silo'],
];

/** Formato do croqui do equipamento, ou null se a categoria não tem croqui. */
export function formatoDoEquipamento(nome: string): TipoItem | null {
  const n = normalizar(nome);
  return FORMATO_DA_CATEGORIA.find(([re]) => re.test(n))?.[1] ?? null;
}

export const idDoCroqui = (equipamentoId: string) => `${equipamentoId}:exterior`;

/** O item "MEDIDAS EXTERNAS" do equipamento (lista vazia se a categoria não tem croqui). */
export function deduzirCroqui(eq: Pick<EquipamentoPcm, 'id' | 'nome'>): ItemPcm[] {
  const tipo = formatoDoEquipamento(eq.nome);
  if (!tipo) return [];
  return [
    {
      id: idDoCroqui(eq.id),
      origem: 'deduzido',
      linha: null,
      nome: NOME_DO_CROQUI,
      especificacao: '',
      quantidade: '',
      tipo,
    },
  ];
}

export const SEM_ACESSO = 'sem acesso';

export const ehSemAcesso = (valor: string | undefined) => normalizar(valor) === 'SEM ACESSO';

export const ehEstimado = (valor: string | undefined) => /^\s*≈/.test(valor ?? '');

/** Põe ou tira o "≈ " na frente do valor, sem mexer no resto do que foi digitado. */
export function comEstimado(valor: string, estimado: boolean): string {
  const sem = valor.replace(/^\s*≈\s*/, '');
  return estimado && sem ? `≈ ${sem}` : sem;
}

/** Onde fica o perímetro de um campo de Ø (chave a mais nas medições, fora dos campos). */
export const chavePerimetro = (campoId: string) => `${campoId}Perimetro`;

/** Ø (mm, inteiro) a partir do perímetro medido com a trena em volta. */
export function diametroDoPerimetro(perimetro: string | undefined): number | null {
  const p = parseMedida(perimetro);
  return p !== null && p > 0 ? Math.round(p / Math.PI) : null;
}

/** Letra no desenho: vazia = falta, cheia = medida, cinza = sem acesso ou não tem. */
export type EstadoCota = 'falta' | 'medida' | 'cinza';

export function estadoDaCota(
  valor: string | undefined,
  perimetro: string | undefined,
  conferencia: Conferencia | undefined,
): EstadoCota {
  if (conferencia === 'naoTem' || ehSemAcesso(valor)) return 'cinza';
  return valor?.trim() || perimetro?.trim() ? 'medida' : 'falta';
}
