import { describe, expect, it } from 'vitest';
import * as x from '../../src/dominio/templates/extratores.ts';
import { TEMPLATES } from '../../src/dominio/templates/registro.ts';

describe('extratores do PCM', () => {
  it('tapete: largura em mm, lonas, coberturas', () => {
    expect(x.larguraTapeteMm('26" 3/16 X 1/16 2 LONAS')).toBe(660.4);
    expect(x.larguraTapeteMm('CORREIA ELEVADORA EP1000/4 12" 1/4 X 1/8"')).toBe(304.8);
    expect(x.larguraTapeteMm('SEM LARGURA')).toBeNull();
    expect(x.lonasTapete('20" 2L PL140')).toBe(2);
    expect(x.lonasTapete('EP1000/4 12"')).toBe(4);
    expect(x.coberturasTapete('26" 3/16 X 1/16 2 LONAS')).toBe('3/16 × 1/16');
    expect(x.espessuraTapeteMm('30" 2 LONAS (10MM)')).toBe(10);
  });

  it('Ø do eixo nas várias grafias do PCM', () => {
    expect(x.diametroEixo('SNA 515 EIXO 63')).toBe(63);
    expect(x.diametroEixo('SNA 515 (ø61X63 EIXO)')).toBe(63);
    expect(x.diametroEixo('SNA 520 MB (ø90 EIXO)')).toBe(90);
    expect(x.diametroEixo('SNA 511 (EIXO 50MM)')).toBe(50);
    expect(x.diametroEixo('SNA 509 (EIXO 38,14)')).toBe(38.14);
    expect(x.diametroEixo('P209')).toBeNull();
  });

  it('motor e redutor', () => {
    expect(x.potenciaCv('MOTOR 7,5CV 880RPM')).toBe(7.5);
    expect(x.rotacaoRpm('MOTOR 1.5CV 1770 RPM 60HZ')).toBe(1770);
    expect(x.reducao('WCR 100 1:30 EIXO VAZADO')).toBe('1:30');
    expect(x.reducao('RED 23,42 / FS 1,26')).toBe('1:23,42');
    expect(x.numeroSerie('WCR84 1:30 SÉRIE: 0000000001')).toBe('0000000001');
    expect(x.saidaRedutor('1:30 EIXO VAZADO')).toBe('Eixo vazado');
    expect(x.saidaRedutor('NAB - EIXO MACICO')).toBe('Eixo maciço');
  });

  it('polia e correia em V', () => {
    expect(x.codigoCorreiaV('B 50')).toBe('B50');
    expect(x.codigoCorreiaV('CORREIA A44')).toBe('A44');
    expect(x.diametroPolia('100 2 GORNES A (ø180X100 EIXO)')).toBe(100);
    expect(x.diametroPolia('POLIA 190MM 2 GORNES A')).toBe(190);
    expect(x.diametroPolia('(ø220MM)')).toBe(220);
    expect(x.canaisPolia('140 3 GORNES C')).toBe(3);
    expect(x.perfilPolia('140 3 GORNES C')).toBe('C');
    expect(x.canaisPolia('POLIA 80MM 2B - FURO 24mm')).toBe(2);
    expect(x.perfilPolia('POLIA 80MM 2B - FURO 24mm')).toBe('B');
    expect(x.furo('POLIA 80MM 2B - FURO 24mm')).toBe(24);
  });
});

describe('registro de templates', () => {
  it('todo tipo tem template com campos de ids únicos', () => {
    for (const [tipo, t] of Object.entries(TEMPLATES)) {
      expect(t.tipo).toBe(tipo);
      const ids = t.campos.map((c) => c.id);
      expect(new Set(ids).size, `ids repetidos em ${tipo}`).toBe(ids.length);
      for (const c of t.campos) {
        if (c.tipo === 'opcoes')
          expect(c.opcoes?.length, `${tipo}.${c.id} sem opções`).toBeGreaterThan(0);
      }
    }
  });
});
