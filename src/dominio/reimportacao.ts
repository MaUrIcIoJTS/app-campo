/**
 * Planeja a troca do PCM no aparelho SEM perder dado do usuário.
 *
 * Ids de equipamento/item dependem da linha da planilha. Se o PCM novo tiver linhas
 * inseridas, os ids mudam. Então:
 *  - casa antigo × novo por uma chave de conteúdo (aba + TAG/nome + nome do item + ocorrência);
 *  - dado do usuário (medição, nota, foto) cujo id mudou é REMAPEADO para o id novo;
 *  - item/equipamento antigo com dado e sem correspondente no PCM novo é MANTIDO como órfão
 *    (com id novo, para não colidir com ids do PCM novo);
 *  - o que não tem dado do usuário é simplesmente substituído.
 */
import type { EquipamentoDb, ItemDb } from '../db/esquema.ts';
import type { Pcm } from './tipos.ts';
import { normalizar } from './texto.ts';

export interface PlanoReimportacao {
  equipamentos: EquipamentoDb[];
  itens: ItemDb[];
  /** [id antigo, id novo] — mover medições/notas/fotos. */
  remapear: [string, string][];
  resumo: { equipamentos: number; itens: number; remapeados: number; orfaos: number };
}

export interface Anteriores {
  equipamentos: readonly EquipamentoDb[];
  itens: readonly ItemDb[];
}

/** Converte o PCM lido para os registros do banco (primeira importação). */
export function registrosDoPcm(pcm: Pcm, importacaoId: string): Anteriores {
  const equipamentos: EquipamentoDb[] = [];
  const itens: ItemDb[] = [];
  let ordemEq = 0;
  let ordemItem = 0;
  for (const aba of pcm.abas) {
    for (const { itens: itensEq, ...eq } of aba.equipamentos) {
      equipamentos.push({ ...eq, importacaoId, ordem: ordemEq++ });
      for (const item of itensEq) itens.push({ ...item, equipamentoId: eq.id, ordem: ordemItem++ });
    }
  }
  return { equipamentos, itens };
}

/** Chaves de conteúdo, estáveis quando só a posição das linhas muda. */
function chaves(regs: Anteriores): { eq: Map<string, string>; item: Map<string, string> } {
  const eq = new Map<string, string>(); // id → chave
  const contaEq = new Map<string, number>();
  for (const e of regs.equipamentos) {
    const base = `${normalizar(e.aba)}|${e.tag ?? normalizar(e.nomeOriginal)}`;
    const n = (contaEq.get(base) ?? 0) + 1;
    contaEq.set(base, n);
    eq.set(e.id, `${base}#${n}`);
  }
  const item = new Map<string, string>();
  const contaItem = new Map<string, number>();
  for (const i of regs.itens) {
    const base = `${eq.get(i.equipamentoId) ?? i.equipamentoId}|${normalizar(i.nome)}`;
    const n = (contaItem.get(base) ?? 0) + 1;
    contaItem.set(base, n);
    item.set(i.id, `${base}#${n}`);
  }
  return { eq, item };
}

function inverter(m: Map<string, string>): Map<string, string> {
  return new Map([...m].map(([id, chave]) => [chave, id]));
}

/**
 * @param idsComDados ids (de item ou equipamento) que têm medição, nota ou foto.
 * @param marca sufixo único para ids de órfãos (ex.: id da importação).
 */
export function planejarReimportacao(
  antigos: Anteriores,
  novos: Anteriores,
  idsComDados: ReadonlySet<string>,
  marca: string,
): PlanoReimportacao {
  const kAnt = chaves(antigos);
  const kNov = chaves(novos);
  const eqNovoPorChave = inverter(kNov.eq);
  const itemNovoPorChave = inverter(kNov.item);
  const idsNovos = new Set([
    ...novos.equipamentos.map((e) => e.id),
    ...novos.itens.map((i) => i.id),
  ]);

  const remapear: [string, string][] = [];
  const equipamentos = [...novos.equipamentos];
  const itens = [...novos.itens];
  const eqAntigo = new Map(antigos.equipamentos.map((e) => [e.id, e]));
  const eqOrfaoPorIdAntigo = new Map<string, string>(); // id antigo → id do órfão
  const idOrfao = (id: string) => `orfao:${marca}:${id}`;
  let orfaos = 0;

  /** Id do equipamento (novo, ou órfão criado agora) que vai receber o que era de `idAntigo`. */
  function destinoEquipamento(idAntigo: string): string {
    const chave = kAnt.eq.get(idAntigo);
    const novo = chave ? eqNovoPorChave.get(chave) : undefined;
    if (novo) return novo;
    let orfao = eqOrfaoPorIdAntigo.get(idAntigo);
    if (!orfao) {
      const antigo = eqAntigo.get(idAntigo);
      orfao = antigo?.orfao ? antigo.id : idOrfao(idAntigo);
      eqOrfaoPorIdAntigo.set(idAntigo, orfao);
      if (antigo)
        equipamentos.push({ ...antigo, id: orfao, orfao: true, ordem: 1e6 + antigo.ordem });
      orfaos++;
    }
    return orfao;
  }

  for (const antigo of antigos.itens) {
    if (!idsComDados.has(antigo.id)) continue;
    const chave = kAnt.item.get(antigo.id);
    const novo = chave ? itemNovoPorChave.get(chave) : undefined;
    if (novo) {
      if (novo !== antigo.id) remapear.push([antigo.id, novo]);
      continue;
    }
    const equipamentoId = destinoEquipamento(antigo.equipamentoId);
    const id = antigo.orfao && !idsNovos.has(antigo.id) ? antigo.id : idOrfao(antigo.id);
    if (id !== antigo.id) remapear.push([antigo.id, id]);
    itens.push({ ...antigo, id, equipamentoId, orfao: true, ordem: 1e6 + antigo.ordem });
    orfaos++;
  }

  for (const antigo of antigos.equipamentos) {
    if (!idsComDados.has(antigo.id)) continue;
    const destino = destinoEquipamento(antigo.id);
    if (destino !== antigo.id) remapear.push([antigo.id, destino]);
  }

  return {
    equipamentos,
    itens,
    remapear,
    resumo: {
      equipamentos: novos.equipamentos.length,
      itens: novos.itens.length,
      remapeados: remapear.filter(([, para]) => !para.startsWith('orfao:')).length,
      orfaos,
    },
  };
}
