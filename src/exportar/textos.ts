/** Textos das colunas que o app acrescenta ao PCM (puro: sem DOM, sem banco). */
import type { Medicao } from '../db/esquema.ts';
import {
  chavePerimetro,
  diametroDoPerimetro,
  ehEstimado,
  ehSemAcesso,
  SEM_ACESSO,
} from '../dominio/croqui.ts';
import { campoDoTambor, rotuloDoTambor } from '../dominio/guias.ts';
import { deltaDoCampo } from '../dominio/medicao.ts';
import { formatarDelta, formatarNumero } from '../dominio/numeros.ts';
import { TEMPLATES, type CampoTemplate } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';

/**
 * Valor de um campo: como digitado (com unidade e Δ), "não se aplica" ou "conforme PCM".
 * Croqui: "sem acesso" sai sem unidade; o Ø medido pelo perímetro sai com a conta.
 */
function valorDoCampo(c: CampoTemplate, item: ItemPcm, m: Medicao): string | null {
  const marca = m.conferencia[c.id];
  const valor = (m.valores[c.id] ?? '').trim();
  if (marca === 'naoTem') return 'não se aplica';
  if (ehSemAcesso(valor)) return SEM_ACESSO;
  const comUnidade = (v: string) => (c.unidade ? `${v} ${c.unidade}` : v);
  const perimetro = c.perimetro ? (m.valores[chavePerimetro(c.id)] ?? '').trim() : '';
  if (perimetro) {
    const textoPerimetro = `perímetro ${comUnidade(perimetro)}`;
    if (valor) return `${comUnidade(valor)} (${textoPerimetro})`;
    const d = diametroDoPerimetro(perimetro);
    if (d === null) return textoPerimetro;
    const aprox = ehEstimado(perimetro) ? '≈ ' : '';
    return `${comUnidade(`${aprox}${formatarNumero(d)}`)} (${textoPerimetro} ÷ π)`;
  }
  if (valor) {
    let t = valor;
    if (c.tipo === 'numero' && c.unidade) t += ` ${c.unidade}`;
    const delta = deltaDoCampo(c, item, valor);
    if (delta !== null) t += ` (Δ ${formatarDelta(delta)})`;
    return t;
  }
  return marca === 'confere' ? 'conforme PCM' : null;
}

/** O que os tambores trazem para uma linha MANCAL/ROLAMENTO/BUCHA do PCM (ver `nosTambores`). */
export interface NosTambores {
  /** "Nos tambores: Tambor 1: SNA 515 · Tambor 2: não se aplica"; vazio se só houver ✗ sem valor. */
  texto: string;
  /** Tambores marcados ✗ neste campo ("Tambor 2"). */
  divergem: string[];
  /** Algum tambor marcado ✓ neste campo. */
  conferem: boolean;
  /** A medição mais recente entre os tambores que têm algo neste campo. */
  atualizadaEm: string | undefined;
}

/**
 * O que foi anotado nos tambores (valor, "Não tem", ✓/✗) no campo que corresponde a uma linha
 * MANCAL/ROLAMENTO/BUCHA do PCM. null nas outras linhas ou se nenhum tambor tem nada nesse
 * campo. O app não sabe de qual tambor é cada linha: se o PCM tem duas linhas do mesmo tipo,
 * as duas levam todos os tambores.
 */
export function nosTambores(
  linha: ItemPcm,
  tambores: readonly ItemPcm[],
  medicoes: ReadonlyMap<string, Medicao>,
): NosTambores | null {
  const id = campoDoTambor(linha);
  const campo = TEMPLATES.tambor.campos.find((c) => c.id === id);
  if (!campo) return null;
  const partes: string[] = [];
  const divergem: string[] = [];
  const datas: string[] = [];
  let conferem = false;
  for (const t of tambores) {
    const m = medicoes.get(t.id);
    if (!m) continue;
    const valor = valorDoCampo(campo, t, m);
    const marca = m.conferencia[campo.id];
    if (valor === null && !marca) continue;
    const rotulo = rotuloDoTambor(t.nome);
    if (valor !== null) partes.push(`${rotulo}: ${valor}`);
    if (marca === 'diverge') divergem.push(rotulo);
    if (marca === 'confere') conferem = true;
    datas.push(m.atualizadaEm);
  }
  if (datas.length === 0) return null;
  return {
    texto: partes.length > 0 ? `Nos tambores: ${partes.join(' · ')}` : '',
    divergem,
    conferem,
    atualizadaEm: maisRecente(datas),
  };
}

/**
 * Coluna "Medido": `rótulo: valor unidade (Δ)` dos campos preenchidos, separados por `; `.
 * Valor como o técnico digitou. "Não tem" → "não se aplica"; ✓ sem valor → "conforme PCM".
 * Valor de um campo que o template não tem mais também sai (nunca some dado). Numa linha
 * MANCAL/ROLAMENTO/BUCHA, o que foi anotado nos tambores vem no fim.
 */
export function textoMedido(
  item: ItemPcm,
  m: Medicao | undefined,
  tambores: NosTambores | null = null,
): string {
  const partes: string[] = [];
  if (m) {
    const campos = TEMPLATES[item.tipo].campos;
    for (const c of campos) {
      const valor = valorDoCampo(c, item, m);
      if (valor !== null) partes.push(`${c.letra ? `${c.letra} — ` : ''}${c.rotulo}: ${valor}`);
    }
    const conhecidos = new Set(
      campos.flatMap((c) => (c.perimetro ? [c.id, chavePerimetro(c.id)] : [c.id])),
    );
    for (const [id, valor] of Object.entries(m.valores)) {
      if (!conhecidos.has(id) && valor.trim()) partes.push(`${id}: ${valor.trim()}`);
    }
  }
  if (tambores?.texto) partes.push(tambores.texto);
  return partes.join('; ');
}

/**
 * Coluna "Confere/Diverge": "Diverge: Largura, Lonas" se algum campo foi marcado ✗;
 * "Confere" se só há ✓; vazio se nada foi marcado. "Não tem" não conta nem como um nem outro.
 * Numa linha MANCAL/ROLAMENTO/BUCHA, os ✓/✗ dos tambores também contam ("Diverge: Tambor 2").
 */
export function textoConferencia(
  item: ItemPcm,
  m: Medicao | undefined,
  tambores: NosTambores | null = null,
): string {
  const conferencia: Medicao['conferencia'] = m?.conferencia ?? {};
  const campos = TEMPLATES[item.tipo].campos;
  const rotulo = new Map(campos.map((c) => [c.id, c.rotulo]));
  const ordem = [...campos.map((c) => c.id), ...Object.keys(conferencia)];
  const divergentes = [...new Set(ordem)]
    .filter((id) => conferencia[id] === 'diverge')
    .map((id) => rotulo.get(id) ?? id);
  divergentes.push(...(tambores?.divergem ?? []));
  if (divergentes.length > 0) return `Diverge: ${divergentes.join(', ')}`;
  return Object.values(conferencia).includes('confere') || tambores?.conferem ? 'Confere' : '';
}

const fotos = (n: number) => (n === 1 ? '1 foto' : `${n} fotos`);

/** Coluna "Observação": a observação do item e, se houver, quantas fotos. */
export function textoObservacao(observacao: string | undefined, nFotos: number): string {
  const obs = (observacao ?? '').trim();
  if (nFotos <= 0) return obs;
  return obs ? `${obs} (${fotos(nFotos)})` : fotos(nFotos);
}

const dois = (n: number) => String(n).padStart(2, '0');

/** `dd/mm/aaaa hh:mm`, hora local. Vazio se a data não for válida. */
export function dataHora(iso: string | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** `dd/mm hh:mm`, hora local (títulos curtos: "Backup de 26/10 14:30"). Vazio se inválida. */
export function dataCurta(data: string | number | Date | undefined): string {
  const d = data === undefined ? null : new Date(data);
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** A mais recente das datas (ISO); undefined se não houver nenhuma. */
export function maisRecente(datas: readonly (string | undefined)[]): string | undefined {
  let max: string | undefined;
  for (const d of datas) if (d && (!max || d > max)) max = d;
  return max;
}

/** "agora há pouco", "há 5 min", "há 2 h", "há 3 dias". */
export function haQuantoTempo(iso: string, agora = Date.now()): string {
  const ms = agora - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'agora há pouco';
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

/** ISO com o fuso do aparelho: "2026-10-26T14:30:00-03:00". */
export function isoLocal(d: Date): string {
  const fuso = -d.getTimezoneOffset();
  const sinal = fuso >= 0 ? '+' : '-';
  const abs = Math.abs(fuso);
  return (
    `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}` +
    `T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}` +
    `${sinal}${dois(Math.floor(abs / 60))}:${dois(abs % 60)}`
  );
}
