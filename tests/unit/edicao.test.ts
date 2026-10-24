import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { banco, fecharBanco } from '../../src/db/banco.ts';
import { anotar, pendentesNoDiario } from '../../src/db/diario.ts';
import {
  chaveMedicao,
  chaveNota,
  pendentesMaisNovos,
  reaplicarDiario,
  registrarMedicao,
  registrarNota,
} from '../../src/db/edicao.ts';
import type { Medicao, NotaEquipamento } from '../../src/db/esquema.ts';
import { criarFilaDeGravacao, type FilaDeGravacao } from '../../src/db/salvamento.ts';
import { memoria } from './memoria.ts';

beforeEach(async () => {
  await fecharBanco();
  globalThis.indexedDB = new IDBFactory();
});
afterEach(() => vi.restoreAllMocks());

/** IndexedDB recusando gravar a medição de `itemId` (celular sem espaço). */
function bancoCheioPara(itemId: string) {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const original = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    valor: unknown,
    chave?: IDBValidKey,
  ) {
    if ((valor as { itemId?: string }).itemId === itemId)
      throw new DOMException('Sem espaço', 'QuotaExceededError');
    return original.call(this, valor, chave);
  });
}

const medicao = (largura: string, atualizadaEm: string): Medicao => ({
  itemId: 'area-1:8:9',
  valores: { largura },
  conferencia: {},
  observacao: '',
  atualizadaEm,
});

const nota = (observacao: string, atualizadaEm: string): NotaEquipamento => ({
  equipamentoId: 'area-1:8',
  observacao,
  atualizadaEm,
});

/** Fila que só guarda as gravações: o teste decide quando (e em que ordem) cada uma roda. */
function filaManual() {
  const agendadas: Array<() => Promise<void>> = [];
  const fila = { agendar: (_chave: string, gravar: () => Promise<void>) => agendadas.push(gravar) };
  return { fila: fila as unknown as FilaDeGravacao, agendadas };
}

describe('registrar edição: diário na hora, banco depois', () => {
  it('anota no diário antes de gravar; depois de gravar, risca', async () => {
    const area = memoria();
    const fila = criarFilaDeGravacao();
    const m = medicao('658', '2026-10-26T10:00:00.000Z');
    registrarMedicao(m, { fila, area });
    expect(pendentesNoDiario(area)).toEqual([[chaveMedicao(m.itemId), m]]);

    await fila.descarregar();
    expect(await (await banco()).get('medicoes', m.itemId)).toEqual(m);
    expect(pendentesNoDiario(area)).toEqual([]);
  });

  it('gravação atrasada da versão anterior não risca a versão nova do diário', async () => {
    const area = memoria();
    const { fila, agendadas } = filaManual();
    const v1 = medicao('65', '2026-10-26T10:00:00.000Z');
    const v2 = medicao('658', '2026-10-26T10:00:00.200Z');
    registrarMedicao(v1, { fila, area });
    registrarMedicao(v2, { fila, area }); // digitou de novo antes de v1 chegar ao banco

    await agendadas[0]!(); // v1 grava agora
    expect(pendentesNoDiario(area)).toEqual([[chaveMedicao(v2.itemId), v2]]);

    await agendadas[1]!();
    expect(await (await banco()).get('medicoes', v2.itemId)).toEqual(v2);
    expect(pendentesNoDiario(area)).toEqual([]);
  });

  it('nota do equipamento segue o mesmo caminho', async () => {
    const area = memoria();
    const fila = criarFilaDeGravacao();
    const n = nota('Esticador no fim do curso', '2026-10-26T10:00:00.000Z');
    registrarNota(n, { fila, area });
    expect(pendentesNoDiario(area)).toEqual([[chaveNota(n.equipamentoId), n]]);
    await fila.descarregar();
    expect(await (await banco()).get('notas', n.equipamentoId)).toEqual(n);
    expect(pendentesNoDiario(area)).toEqual([]);
  });
});

describe('reaplicar o diário ao abrir o app', () => {
  it('app morto antes da gravação: o que estava só no diário vai para o banco', async () => {
    const area = memoria();
    const { fila } = filaManual(); // a fila nunca chega a gravar
    const m = medicao('658', '2026-10-26T10:00:00.000Z');
    const n = nota('Emenda nova', '2026-10-26T10:00:01.000Z');
    registrarMedicao(m, { fila, area });
    registrarNota(n, { fila, area });

    expect(await reaplicarDiario(area)).toBe(2);
    const db = await banco();
    expect(await db.get('medicoes', m.itemId)).toEqual(m);
    expect(await db.get('notas', n.equipamentoId)).toEqual(n);
    expect(pendentesNoDiario(area)).toEqual([]);
  });

  it('não sobrescreve o banco com versão mais velha do diário, mas risca a velha', async () => {
    const area = memoria();
    const db = await banco();
    const noBanco = medicao('658', '2026-10-26T10:00:05.000Z');
    await db.put('medicoes', noBanco);
    anotar(chaveMedicao(noBanco.itemId), medicao('65', '2026-10-26T10:00:00.000Z'), area);

    expect(await reaplicarDiario(area)).toBe(0);
    expect(await db.get('medicoes', noBanco.itemId)).toEqual(noBanco);
    expect(pendentesNoDiario(area)).toEqual([]);
  });

  it('versão do diário mais nova que a do banco substitui', async () => {
    const area = memoria();
    const db = await banco();
    await db.put('notas', nota('Emenda', '2026-10-26T10:00:00.000Z'));
    const nova = nota('Emenda nova, trocar em 30 dias', '2026-10-26T10:00:09.000Z');
    anotar(chaveNota(nova.equipamentoId), nova, area);

    expect(await reaplicarDiario(area)).toBe(1);
    expect(await db.get('notas', nova.equipamentoId)).toEqual(nova);
  });

  it('entrada estranha fica no diário e não vai para o banco', async () => {
    const area = memoria();
    anotar('medicao:x', { valores: 'quebrado' }, area);
    anotar('medicao:outro-id', medicao('1', '2026-10-26T10:00:00.000Z'), area); // chave ≠ itemId
    anotar('desconhecido:1', { a: 1 }, area);

    expect(await reaplicarDiario(area)).toBe(0);
    expect(await (await banco()).count('medicoes')).toBe(0);
    expect(pendentesNoDiario(area)).toHaveLength(3);
  });

  it('banco cheio: a entrada que falha fica no diário e não impede as outras', async () => {
    const area = memoria();
    const cheia = { ...medicao('658', '2026-10-26T10:00:00.000Z'), itemId: 'area-1:8:1' };
    const outra = medicao('2', '2026-10-26T10:00:01.000Z');
    const n = nota('Emenda', '2026-10-26T10:00:02.000Z');
    anotar(chaveMedicao(cheia.itemId), cheia, area);
    anotar(chaveMedicao(outra.itemId), outra, area);
    anotar(chaveNota(n.equipamentoId), n, area);
    bancoCheioPara(cheia.itemId);

    expect(await reaplicarDiario(area)).toBe(2);
    const db = await banco();
    expect(await db.get('medicoes', cheia.itemId)).toBeUndefined();
    expect(await db.get('medicoes', outra.itemId)).toEqual(outra);
    expect(await db.get('notas', n.equipamentoId)).toEqual(n);
    expect(pendentesNoDiario(area)).toEqual([[chaveMedicao(cheia.itemId), cheia]]);
  });

  it('diário vazio ou bloqueado: não faz nada', async () => {
    expect(await reaplicarDiario(memoria())).toBe(0);
    expect(await reaplicarDiario(null)).toBe(0);
  });
});

describe('o que o banco não confirmou volta para a tela', () => {
  it('só o que está no diário e é mais novo que o carregado do banco', () => {
    const area = memoria();
    const noDiario = medicao('658', '2026-10-26T10:00:05.000Z');
    const velha = { ...medicao('1', '2026-10-26T09:00:00.000Z'), itemId: 'area-1:8:2' };
    const n = nota('Emenda', '2026-10-26T10:00:05.000Z');
    anotar(chaveMedicao(noDiario.itemId), noDiario, area);
    anotar(chaveMedicao(velha.itemId), velha, area);
    anotar(chaveNota(n.equipamentoId), n, area);
    anotar('medicao:lixo', { a: 1 }, area);

    const doBanco = new Map([
      [noDiario.itemId, medicao('65', '2026-10-26T10:00:00.000Z')],
      [velha.itemId, { ...velha, atualizadaEm: '2026-10-26T09:30:00.000Z' }],
    ]);
    expect(pendentesMaisNovos(doBanco, new Map(), area)).toEqual({
      medicoes: [noDiario],
      notas: [n],
    });
  });

  it('cenário completo: banco cheio ao abrir, a medida não some na edição seguinte', async () => {
    const area = memoria();
    const { fila } = filaManual();
    const lonas = medicao('2', '2026-10-26T10:00:00.000Z');
    registrarMedicao(lonas, { fila, area }); // app morreu antes de gravar
    bancoCheioPara(lonas.itemId);
    await reaplicarDiario(area); // falha: fica no diário

    const pendentes = pendentesMaisNovos(new Map(), new Map(), area);
    expect(pendentes.medicoes).toEqual([lonas]); // a tela mostra "2" e a fila tenta de novo
  });
});
