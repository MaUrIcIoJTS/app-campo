import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lerPcm, parseAba } from '../../src/dominio/pcm/parser.ts';
import type { EquipamentoPcm, Pcm } from '../../src/dominio/tipos.ts';

const FIXTURES = ['tests/fixtures/pcm-ficticio.xls', 'tests/fixtures/pcm-ficticio.xlsx'];

function porTag(pcm: Pcm, tag: string): EquipamentoPcm {
  const eq = pcm.abas.flatMap((a) => a.equipamentos).find((e) => e.tag === tag);
  if (!eq) throw new Error(`TAG ${tag} não encontrada`);
  return eq;
}

describe.each(FIXTURES)('lerPcm(%s)', (arquivo) => {
  const pcm = lerPcm(readFileSync(arquivo));

  it('lê todas as abas, na ordem', () => {
    expect(pcm.abas.map((a) => a.nome)).toEqual(['AREA 1', 'SECAGEM E CLASSIFICAÇÃO']);
    expect(pcm.abas.every((a) => a.avisos.length === 0)).toBe(true);
  });

  it('lê todos os equipamentos, com e sem TAG', () => {
    const [a1, a2] = pcm.abas;
    expect(a1?.equipamentos.map((e) => e.tag)).toEqual([
      null,
      null,
      'XA-TC-01',
      'XA-TC-02',
      'XA-EC-01',
    ]);
    expect(a2?.equipamentos).toHaveLength(5);
  });

  it('para no "OBSERVAÇÕES" e ignora o rodapé', () => {
    const nomes = pcm.abas.flatMap((a) =>
      a.equipamentos.flatMap((e) => e.itens.map((i) => i.nome)),
    );
    expect(nomes).not.toContain('ITEM DEPOIS DO RODAPÉ');
    expect(pcm.abas.flatMap((a) => a.equipamentos).map((e) => e.nomeOriginal)).not.toContain(
      'OBSERVAÇÕES',
    );
  });

  it('itens herdam o equipamento da linha mesclada', () => {
    const tc01 = porTag(pcm, 'XA-TC-01');
    expect(tc01.nome).toBe('TRANSPORTADORA 01 - TESTE');
    const doPcm = tc01.itens.filter((i) => i.origem === 'pcm');
    expect(doPcm.map((i) => i.nome)).toEqual([
      'TAPETE',
      'ROLETE DE CARGA',
      'ROLETE DE RETORNO',
      'REDUTOR',
      'MOTOR',
      'MANCAL',
      'ROLAMENTO',
      'BUCHA',
      'POLIA DO MOTOR',
      'CORREIA EM V',
      'CHAVE DE SEGURANÇA',
    ]);
    expect(doPcm[0]).toMatchObject({
      especificacao: '26" 3/16 X 1/16 2 LONAS',
      quantidade: '23 METROS',
      tipo: 'tapete',
    });
  });

  it('guarda a linha original de cada item (para exportar ao lado)', () => {
    const tc01 = porTag(pcm, 'XA-TC-01');
    const linhas = tc01.itens.filter((i) => i.origem === 'pcm').map((i) => i.linha);
    expect(linhas[0]).toBe(tc01.linha);
    expect(linhas).toEqual(linhas.map((_, k) => tc01.linha + k));
  });

  it('ids únicos mesmo com nomes repetidos entre abas', () => {
    const eqs = pcm.abas.flatMap((a) => a.equipamentos);
    const salas = eqs.filter((e) => e.nome === 'SALA DE PAINÉIS');
    expect(salas).toHaveLength(2);
    expect(new Set(eqs.map((e) => e.id)).size).toBe(eqs.length);
    const itens = eqs.flatMap((e) => e.itens);
    expect(new Set(itens.map((i) => i.id)).size).toBe(itens.length);
  });

  it('bloco de uma linha sem coluna B vira item "(sem descrição)"', () => {
    const vv = porTag(pcm, 'XB-VV-04');
    expect(vv.itens).toEqual([
      expect.objectContaining({
        nome: '(sem descrição)',
        quantidade: '1 UNIDADE',
        tipo: 'generico',
      }),
    ]);
  });

  it('deduz tambores dos mancais: mínimo 2, um a cada 2 mancais', () => {
    const tambores = (tag: string) => porTag(pcm, tag).itens.filter((i) => i.tipo === 'tambor');
    expect(tambores('XA-TC-01')).toHaveLength(2); // 4 mancais
    expect(tambores('XA-TC-02')).toHaveLength(5); // 10 mancais
    expect(tambores('XA-EC-01')).toHaveLength(2); // 2 de cima + 2 de baixo
    expect(tambores('XB-PV-01')).toHaveLength(0); // sem tapete
    expect(tambores('XA-TC-01')[0]).toMatchObject({
      origem: 'deduzido',
      linha: null,
      especificacao: 'SNA 515 EIXO 63',
    });
  });
});

describe('parseAba', () => {
  it('avisa quando não acha cabeçalho nem "OBSERVAÇÕES"', () => {
    const linhas = [...Array(6).fill([]), ['EQUIP X1-AA-01', 'MOTOR', '5CV', '1 UNIDADE']];
    const aba = parseAba('TESTE', linhas);
    expect(aba.equipamentos).toHaveLength(1);
    expect(aba.avisos).toHaveLength(2);
  });

  it('item antes de qualquer equipamento é ignorado com aviso', () => {
    const linhas = [
      ['EQUIPAMENTOS PARA INSPEÇÃO'],
      [],
      ['', 'MOTOR', '5CV', '1 UNIDADE'],
      ['OBSERVAÇÕES'],
    ];
    const aba = parseAba('TESTE', linhas);
    expect(aba.equipamentos).toHaveLength(0);
    expect(aba.avisos[0]).toMatch(/sem equipamento/);
  });
});
