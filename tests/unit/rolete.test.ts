import { describe, expect, it } from 'vitest';
import { parseCodigoRolete } from '../../src/dominio/rolete.ts';

describe('parseCodigoRolete', () => {
  it('lê A×B×C×D×E na ordem do PCM', () => {
    expect(parseCodigoRolete('262x300x102x14x20')).toEqual({
      comprimentoTubo: 262,
      comprimentoEixo: 300,
      diametroTubo: 102,
      fresado: 14,
      diametroEixo: 20,
    });
  });

  it('quando vem …x20x14, o menor é o fresado', () => {
    expect(parseCodigoRolete('260x300X100X20X14')).toMatchObject({ fresado: 14, diametroEixo: 20 });
  });

  it('aceita X maiúsculo, ×, espaços e vírgula decimal', () => {
    expect(parseCodigoRolete('672 X 702 × 100 x 14 x 20,5')).toMatchObject({
      comprimentoTubo: 672,
      diametroEixo: 20.5,
    });
  });

  it.each(['', '212x250x102x14', 'INDEFINIDO', '212x250x102x14x20x9', 'ax250x102x14x20'])(
    'rejeita %j',
    (codigo) => {
      expect(parseCodigoRolete(codigo)).toBeNull();
    },
  );
});
