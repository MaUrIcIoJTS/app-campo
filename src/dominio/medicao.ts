/** Regras puras de edição da medição de um item (a UI só chama estas funções). */
import type { Conferencia, Medicao, NotaEquipamento } from '../db/esquema.ts';
import { arredondar, formatarNumero, medidaAmbigua, parseMedida, parseNumero } from './numeros.ts';
import { TEMPLATES, type CampoTemplate } from './templates/registro.ts';
import type { ItemPcm } from './tipos.ts';

/**
 * Carimbo de alteração sempre MAIOR que o da versão anterior do mesmo registro, mesmo se o
 * relógio do celular voltar (ajuste da operadora). Ao reabrir o app, o diário só vence o
 * banco se for mais novo — com relógio voltando, a última digitação perderia.
 */
export function carimbo(anterior?: string, agora = Date.now()): string {
  const antes = anterior ? Date.parse(anterior) : NaN;
  return new Date(Number.isFinite(antes) ? Math.max(agora, antes + 1) : agora).toISOString();
}

export function medicaoVazia(itemId: string): Medicao {
  return { itemId, valores: {}, conferencia: {}, observacao: '', atualizadaEm: carimbo() };
}

/** Novo valor digitado (guardado como texto, do jeito que o técnico escreveu). */
export function comValor(
  m: Medicao | undefined,
  itemId: string,
  campoId: string,
  valor: string,
): Medicao {
  const base = m ?? medicaoVazia(itemId);
  const valores = { ...base.valores };
  if (valor === '') delete valores[campoId];
  else valores[campoId] = valor;
  return { ...base, valores, atualizadaEm: carimbo(base.atualizadaEm) };
}

/** ✓/✗/"não tem" por campo. Tocar de novo na mesma marca desmarca. */
export function comConferencia(
  m: Medicao | undefined,
  itemId: string,
  campoId: string,
  marca: Conferencia,
): Medicao {
  const base = m ?? medicaoVazia(itemId);
  const conferencia = { ...base.conferencia };
  if (conferencia[campoId] === marca) delete conferencia[campoId];
  else conferencia[campoId] = marca;
  return { ...base, conferencia, atualizadaEm: carimbo(base.atualizadaEm) };
}

export function comObservacao(m: Medicao | undefined, itemId: string, observacao: string): Medicao {
  const base = m ?? medicaoVazia(itemId);
  return { ...base, observacao, atualizadaEm: carimbo(base.atualizadaEm) };
}

export function novaNota(
  equipamentoId: string,
  observacao: string,
  anterior?: NotaEquipamento,
): NotaEquipamento {
  return { equipamentoId, observacao, atualizadaEm: carimbo(anterior?.atualizadaEm) };
}

/** `irmaos`: os outros itens do equipamento (o tambor lê o mancal na linha MANCAL). */
export function valorPcm(
  campo: CampoTemplate,
  item: ItemPcm,
  irmaos: readonly ItemPcm[] = [],
): string | number | null {
  return campo.pcm?.(item, irmaos) ?? null;
}

/** Δ = medido − PCM, só para campo numérico com os dois lados numéricos. */
export function deltaDoCampo(
  campo: CampoTemplate,
  item: ItemPcm,
  valor: string | undefined,
  irmaos: readonly ItemPcm[] = [],
): number | null {
  if (campo.tipo !== 'numero' || !valor) return null;
  const medido = parseMedida(valor);
  const pcm = parseNumero(valorPcm(campo, item, irmaos));
  return medido === null || pcm === null ? null : arredondar(medido - pcm, 3);
}

/** Campo numérico com texto que não é número: avisa, mas guarda o texto mesmo assim. */
export function numeroInvalido(campo: CampoTemplate, valor: string | undefined): boolean {
  return campo.tipo === 'numero' && !!valor?.trim() && parseMedida(valor) === null;
}

/** "12.450" em campo numérico: perguntar se é 12450 ou 12,45. */
export function numeroAmbiguo(campo: CampoTemplate, valor: string | undefined): boolean {
  return campo.tipo === 'numero' && medidaAmbigua(valor);
}

/** Avisos de conferência do item inteiro (ex.: tapete com LD ≠ LE). */
export function avisosDoItem(item: Pick<ItemPcm, 'tipo'>, m: Medicao | undefined): string[] {
  const avisos: string[] = [];
  if (item.tipo === 'tapete' && m) {
    const ld = parseMedida(m.valores.centroLd);
    const le = parseMedida(m.valores.centroLe);
    // "12.450" já tem a pergunta no próprio campo; um Δ com ele seria absurdo.
    const ambiguo = medidaAmbigua(m.valores.centroLd) || medidaAmbigua(m.valores.centroLe);
    if (ld !== null && le !== null && ld !== le && !ambiguo) {
      const dif = formatarNumero(Math.abs(ld - le));
      avisos.push(`LD e LE diferentes: ${dif} mm. Confira alinhamento e esticador.`);
    }
  }
  return avisos;
}

/** O item diverge se qualquer campo foi marcado ✗. */
export function itemDiverge(item: Pick<ItemPcm, 'tipo'>, m: Medicao | undefined): boolean {
  if (!m) return false;
  return TEMPLATES[item.tipo].campos.some((c) => m.conferencia[c.id] === 'diverge');
}
