import { describe, expect, it } from 'vitest';
import { extrairTag } from '../../src/dominio/pcm/tag.ts';

describe('extrairTag', () => {
  it.each([
    ['TRANSPORTADORA 04 - CAL XA-TC-04', 'XA-TC-04', 'TRANSPORTADORA 04 - CAL'],
    ['PENEIRA VIBRATÓRIA - XB-PV-01', 'XB-PV-01', 'PENEIRA VIBRATÓRIA'],
    ['SKIP   - X1-SK-01', 'X1-SK-01', 'SKIP'],
    ['SILO DE CAL SILO-X1-11; SILO-X1-12; SILO-X1-13', 'SILO-X1-11', 'SILO DE CAL'],
  ])('%j → TAG %j', (colunaA, tag, nome) => {
    expect(extrairTag(colunaA)).toEqual({ tag, nome });
  });

  it('pega a TAG e não o apelido "ELEV-01"', () => {
    expect(extrairTag('ELEVADOR DE CANECAS          XA-EC-01 (ELEV-01) - LEVA CAL').tag).toBe(
      'XA-EC-01',
    );
  });

  it('equipamento sem TAG mantém o nome inteiro', () => {
    expect(extrairTag('SALA DE PAINÉIS - SP-X1')).toEqual({
      tag: null,
      nome: 'SALA DE PAINÉIS - SP-X1',
    });
    expect(extrairTag('  ILUMINAÇÃO GERAL   E TOMADAS ')).toEqual({
      tag: null,
      nome: 'ILUMINAÇÃO GERAL E TOMADAS',
    });
  });
});
