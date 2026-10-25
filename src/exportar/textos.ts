/** Textos das colunas que o app acrescenta ao PCM (puro: sem DOM, sem banco). */
import type { Medicao } from '../db/esquema.ts';
import { deltaDoCampo } from '../dominio/medicao.ts';
import { formatarDelta } from '../dominio/numeros.ts';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';

/**
 * Coluna "Medido": `rótulo: valor unidade (Δ)` dos campos preenchidos, separados por `; `.
 * Valor como o técnico digitou. "Não tem" → "não se aplica"; ✓ sem valor → "conforme PCM".
 * Valor de um campo que o template não tem mais também sai (nunca some dado).
 */
export function textoMedido(item: ItemPcm, m: Medicao | undefined): string {
  if (!m) return '';
  const campos = TEMPLATES[item.tipo].campos;
  const partes: string[] = [];
  for (const c of campos) {
    const marca = m.conferencia[c.id];
    const valor = (m.valores[c.id] ?? '').trim();
    if (marca === 'naoTem') {
      partes.push(`${c.rotulo}: não se aplica`);
    } else if (valor) {
      let t = `${c.rotulo}: ${valor}`;
      if (c.tipo === 'numero' && c.unidade) t += ` ${c.unidade}`;
      const delta = deltaDoCampo(c, item, valor);
      if (delta !== null) t += ` (Δ ${formatarDelta(delta)})`;
      partes.push(t);
    } else if (marca === 'confere') {
      partes.push(`${c.rotulo}: conforme PCM`);
    }
  }
  const conhecidos = new Set(campos.map((c) => c.id));
  for (const [id, valor] of Object.entries(m.valores)) {
    if (!conhecidos.has(id) && valor.trim()) partes.push(`${id}: ${valor.trim()}`);
  }
  return partes.join('; ');
}

/**
 * Coluna "Confere/Diverge": "Diverge: Largura, Lonas" se algum campo foi marcado ✗;
 * "Confere" se só há ✓; vazio se nada foi marcado. "Não tem" não conta nem como um nem outro.
 */
export function textoConferencia(item: ItemPcm, m: Medicao | undefined): string {
  if (!m) return '';
  const campos = TEMPLATES[item.tipo].campos;
  const rotulo = new Map(campos.map((c) => [c.id, c.rotulo]));
  const ordem = [...campos.map((c) => c.id), ...Object.keys(m.conferencia)];
  const divergentes = [...new Set(ordem)].filter((id) => m.conferencia[id] === 'diverge');
  if (divergentes.length > 0)
    return `Diverge: ${divergentes.map((id) => rotulo.get(id) ?? id).join(', ')}`;
  return Object.values(m.conferencia).includes('confere') ? 'Confere' : '';
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
