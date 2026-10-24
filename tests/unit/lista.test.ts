import { describe, expect, it } from 'vitest';
import { filtrarEquipamentos, proximoEquipamento } from '../../src/dominio/busca.ts';
import { percentual, progressoItem, somarProgresso } from '../../src/dominio/progresso.ts';
import type { Medicao } from '../../src/db/esquema.ts';

const EQUIPAMENTOS = [
  { tag: 'XA-TC-04', nomeOriginal: 'TRANSPORTADORA 04 - CAL XA-TC-04', aba: 'AREA 1' },
  { tag: 'XA-EC-01', nomeOriginal: 'ELEVADOR DE CANECAS XA-EC-01', aba: 'AREA 1' },
  { tag: null, nomeOriginal: 'SALA DE PAINÉIS', aba: 'AREA 1' },
  { tag: null, nomeOriginal: 'SALA DE PAINÉIS', aba: 'SECAGEM E CLASSIFICAÇÃO' },
  {
    tag: 'XB-PV-01',
    nomeOriginal: 'PENEIRA VIBRATÓRIA - XB-PV-01',
    aba: 'SECAGEM E CLASSIFICAÇÃO',
  },
];

describe('filtrarEquipamentos', () => {
  const tags = (termo: string, aba = '') =>
    filtrarEquipamentos(EQUIPAMENTOS, termo, aba).map((e) => e.tag ?? e.nomeOriginal);

  it('sem filtro devolve tudo', () => {
    expect(tags('')).toHaveLength(5);
    expect(tags('   ')).toHaveLength(5);
  });

  it('busca por TAG, com ou sem hífen, maiúscula ou minúscula', () => {
    expect(tags('XA-TC-04')).toEqual(['XA-TC-04']);
    expect(tags('tc04')).toEqual(['XA-TC-04']);
    expect(tags('tc-04')).toEqual(['XA-TC-04']);
  });

  it('busca por pedaços do nome, sem acento, em qualquer ordem', () => {
    expect(tags('cal transp')).toEqual(['XA-TC-04']);
    expect(tags('paineis')).toEqual(['SALA DE PAINÉIS', 'SALA DE PAINÉIS']);
    expect(tags('vibratoria')).toEqual(['XB-PV-01']);
  });

  it('filtra por aba e combina com o texto', () => {
    expect(tags('', 'SECAGEM E CLASSIFICAÇÃO')).toEqual(['SALA DE PAINÉIS', 'XB-PV-01']);
    expect(tags('sala', 'AREA 1')).toEqual(['SALA DE PAINÉIS']);
    expect(tags('xyz')).toEqual([]);
  });
});

describe('proximoEquipamento', () => {
  const lista = [
    { id: 'a:1', aba: 'AREA 1' },
    { id: 'a:2', aba: 'AREA 1' },
    { id: 'b:1', aba: 'AREA 2' },
  ];
  const proximo = (id: string, aba = '') => proximoEquipamento(lista, id, aba)?.id ?? null;

  it('segue a ordem do PCM, atravessando abas quando não há filtro', () => {
    expect(proximo('a:1')).toBe('a:2');
    expect(proximo('a:2')).toBe('b:1');
    expect(proximo('b:1')).toBeNull();
    expect(proximo('nao-existe')).toBeNull();
  });

  it('com a aba filtrada, para no último equipamento dela', () => {
    expect(proximo('a:1', 'AREA 1')).toBe('a:2');
    expect(proximo('a:2', 'AREA 1')).toBeNull();
    expect(proximo('a:2', 'AREA 2')).toBe('b:1'); // o atual nem está na aba filtrada
  });
});

describe('progresso', () => {
  const medicao = (
    valores: Record<string, string>,
    conf: Medicao['conferencia'] = {},
  ): Medicao => ({
    itemId: 'i',
    valores,
    conferencia: conf,
    observacao: '',
    atualizadaEm: '',
  });

  it('item sem medição: 0 de N campos do template', () => {
    expect(progressoItem({ tipo: 'rolete' })).toEqual({
      preenchidos: 0,
      total: 6,
      divergencias: 0,
    });
  });

  it('conta campo com valor ou com ✓/✗; ignora espaços', () => {
    const p = progressoItem(
      { tipo: 'rolete' },
      medicao({ a: '262', b: ' ', c: '102' }, { d: 'confere', e: 'diverge' }),
    );
    expect(p).toEqual({ preenchidos: 4, total: 6, divergencias: 1 });
  });

  it('soma e percentual por equipamento', () => {
    const total = somarProgresso([
      { preenchidos: 4, total: 6, divergencias: 1 },
      { preenchidos: 1, total: 4, divergencias: 0 },
    ]);
    expect(total).toEqual({ preenchidos: 5, total: 10, divergencias: 1 });
    expect(percentual(total)).toBe(50);
    expect(percentual({ preenchidos: 0, total: 0, divergencias: 0 })).toBe(0);
    expect(percentual({ preenchidos: 2, total: 3, divergencias: 0 })).toBe(66);
  });
});
