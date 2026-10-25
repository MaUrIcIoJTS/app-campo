/**
 * Caminho de toda edição do técnico até o IndexedDB:
 *   1. anota no diário (localStorage, síncrono) — sobrevive se o Android matar o app agora;
 *   2. agenda na fila (grava em até ~300 ms, ou na hora ao esconder/fechar o app);
 *   3. gravado, risca do diário — só se nenhuma versão mais nova foi anotada no meio.
 * Ao abrir o app, `reaplicarDiario` grava o que ficou no diário e não chegou ao banco; o que
 * nem assim gravou (banco cheio) volta para a tela e para a fila com `pendentesMaisNovos`.
 */
import { banco } from './banco.ts';
import { anotar, pendentesNoDiario, riscarSe, type Armazenamento } from './diario.ts';
import type { Medicao, NotaEquipamento } from './esquema.ts';
import { salvarMedicao, salvarNota } from './repositorio.ts';
import { filaDeGravacao, type FilaDeGravacao } from './salvamento.ts';

export const chaveMedicao = (itemId: string) => `medicao:${itemId}`;
export const chaveNota = (equipamentoId: string) => `nota:${equipamentoId}`;

/** Fila e diário são trocáveis nos testes. `area: null` = sem diário. */
interface Destino {
  fila?: FilaDeGravacao;
  area?: Armazenamento | null;
}

function registrar(
  chave: string,
  registro: unknown,
  gravar: () => Promise<void>,
  { fila = filaDeGravacao, area }: Destino,
): void {
  anotar(chave, registro, area);
  fila.agendar(chave, async () => {
    await gravar();
    riscarSe(chave, registro, area);
  });
}

export function registrarMedicao(m: Medicao, destino: Destino = {}): void {
  registrar(chaveMedicao(m.itemId), m, () => salvarMedicao(m), destino);
}

export function registrarNota(n: NotaEquipamento, destino: Destino = {}): void {
  registrar(chaveNota(n.equipamentoId), n, () => salvarNota(n), destino);
}

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function ehMedicao(r: unknown): r is Medicao {
  return (
    ehObjeto(r) &&
    ehTexto(r.itemId) &&
    ehObjeto(r.valores) &&
    ehObjeto(r.conferencia) &&
    ehTexto(r.observacao) &&
    ehTexto(r.atualizadaEm)
  );
}

export function ehNota(r: unknown): r is NotaEquipamento {
  return (
    ehObjeto(r) && ehTexto(r.equipamentoId) && ehTexto(r.observacao) && ehTexto(r.atualizadaEm)
  );
}

export type RegistroDoDiario =
  | { tipo: 'medicao'; chave: string; valor: Medicao }
  | { tipo: 'nota'; chave: string; valor: NotaEquipamento };

/** Valida uma entrada do diário. Entrada estranha (ou de chave trocada) vira null. */
export function lerRegistro(chave: string, valor: unknown): RegistroDoDiario | null {
  if (ehMedicao(valor) && chave === chaveMedicao(valor.itemId))
    return { tipo: 'medicao', chave, valor };
  if (ehNota(valor) && chave === chaveNota(valor.equipamentoId))
    return { tipo: 'nota', chave, valor };
  return null;
}

/** Medições e notas válidas que estão no diário (ainda sem confirmação do banco). */
export function registrosNoDiario(area?: Armazenamento | null): RegistroDoDiario[] {
  return pendentesNoDiario(area)
    .map(([chave, valor]) => lerRegistro(chave, valor))
    .filter((r): r is RegistroDoDiario => r !== null);
}

export const maisNovo = (a: { atualizadaEm: string }, b?: { atualizadaEm: string }) =>
  !b || a.atualizadaEm > b.atualizadaEm;

/**
 * Ao abrir o app, antes de carregar os dados: grava no IndexedDB o que ficou no diário — só
 * se for mais novo que o que está no banco — e risca. Uma entrada que falha (banco cheio)
 * fica no diário e não impede as outras. Devolve quantos registros foram gravados.
 */
export async function reaplicarDiario(area?: Armazenamento | null): Promise<number> {
  const registros = registrosNoDiario(area);
  if (registros.length === 0) return 0;
  const db = await banco();
  let gravados = 0;
  for (const r of registros) {
    try {
      let gravou: boolean;
      if (r.tipo === 'medicao') {
        const tx = db.transaction('medicoes', 'readwrite');
        tx.done.catch(() => {}); // se abortar (banco cheio), o erro vem pelo put/await abaixo
        gravou = maisNovo(r.valor, await tx.store.get(r.valor.itemId));
        if (gravou) await tx.store.put(r.valor);
        await tx.done;
      } else {
        const tx = db.transaction('notas', 'readwrite');
        tx.done.catch(() => {}); // se abortar (banco cheio), o erro vem pelo put/await abaixo
        gravou = maisNovo(r.valor, await tx.store.get(r.valor.equipamentoId));
        if (gravou) await tx.store.put(r.valor);
        await tx.done;
      }
      if (gravou) gravados++;
      riscarSe(r.chave, r.valor, area);
    } catch (e) {
      console.error('Diário: não gravou', r.chave, e);
    }
  }
  return gravados;
}

/**
 * Depois de carregar do banco: o que ainda está no diário e é mais novo que o carregado.
 * A tela tem que mostrar isto (e a fila tentar de novo), senão a próxima edição do mesmo
 * item partiria da versão velha do banco e apagaria a medida do diário.
 */
export function pendentesMaisNovos(
  medicoes: ReadonlyMap<string, Medicao>,
  notas: ReadonlyMap<string, NotaEquipamento>,
  area?: Armazenamento | null,
): { medicoes: Medicao[]; notas: NotaEquipamento[] } {
  const saida = { medicoes: [] as Medicao[], notas: [] as NotaEquipamento[] };
  for (const r of registrosNoDiario(area)) {
    if (r.tipo === 'medicao' && maisNovo(r.valor, medicoes.get(r.valor.itemId)))
      saida.medicoes.push(r.valor);
    if (r.tipo === 'nota' && maisNovo(r.valor, notas.get(r.valor.equipamentoId)))
      saida.notas.push(r.valor);
  }
  return saida;
}
