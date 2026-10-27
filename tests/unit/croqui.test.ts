import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Medicao } from '../../src/db/esquema.ts';
import {
  comEstimado,
  deduzirCroqui,
  diametroDoPerimetro,
  ehEstimado,
  ehSemAcesso,
  estadoDaCota,
  formatoDoEquipamento,
} from '../../src/dominio/croqui.ts';
import { guiaDoItem, guiasDaFicha } from '../../src/dominio/guias.ts';
import { numeroAmbiguo, numeroInvalido } from '../../src/dominio/medicao.ts';
import { parseMedida } from '../../src/dominio/numeros.ts';
import { lerPcm } from '../../src/dominio/pcm/parser.ts';
import { progressoItem } from '../../src/dominio/progresso.ts';
import { TEMPLATES } from '../../src/dominio/templates/registro.ts';
import type { ItemPcm } from '../../src/dominio/tipos.ts';
import { textoMedido } from '../../src/exportar/textos.ts';

describe('categoria do equipamento → croqui', () => {
  it('pela 1ª palavra do nome', () => {
    expect(formatoDoEquipamento('AEROSEPARADOR 01 - TESTE')).toBe('corpo-aeroseparador');
    expect(formatoDoEquipamento('Aero separador da moagem')).toBe('corpo-aeroseparador');
    expect(formatoDoEquipamento('SEPARADOR DINÂMICO')).toBe('corpo-aeroseparador');
    expect(formatoDoEquipamento('SILO DE CAL HIDRATADA')).toBe('corpo-silo');
  });

  it('a palavra no meio do nome não conta ("válvula do silo" é válvula)', () => {
    expect(formatoDoEquipamento('VALVULA ROTATIVA DO SILO')).toBeNull();
    expect(formatoDoEquipamento('ROSCA DO CICLONE')).toBeNull();
    expect(formatoDoEquipamento('TRANSPORTADORA PARA O SILO')).toBeNull();
    expect(formatoDoEquipamento('SILOS')).toBeNull();
  });

  it('deduz um item "MEDIDAS EXTERNAS" com id estável, na guia Exterior', () => {
    expect(deduzirCroqui({ id: 'area-2:20', nome: 'SILO 02' })).toEqual([
      {
        id: 'area-2:20:exterior',
        origem: 'deduzido',
        linha: null,
        nome: 'MEDIDAS EXTERNAS',
        especificacao: '',
        quantidade: '',
        tipo: 'corpo-silo',
      },
    ]);
    expect(deduzirCroqui({ id: 'area-1:6', nome: 'TRANSPORTADORA 01' })).toEqual([]);
    expect(guiaDoItem({ tipo: 'corpo-silo' })).toBe('exterior');
  });

  it('na fixture: só o aeroseparador ganha o croqui, e a ficha abre na guia Exterior', () => {
    const pcm = lerPcm(readFileSync('tests/fixtures/pcm-ficticio.xls'));
    const eqs = pcm.abas.flatMap((a) => a.equipamentos);
    const comCroqui = eqs.filter((e) => e.itens.some((i) => i.tipo.startsWith('corpo-')));
    expect(comCroqui.map((e) => e.tag)).toEqual(['XB-AS-01']);
    const guias = guiasDaFicha(comCroqui[0]!.itens).map((g) => g.id);
    expect(guias).toEqual(['pcm', 'exterior', 'acionamento', 'outros', 'fotos', 'notas']);
  });
});

describe('sem acesso, estimado e perímetro', () => {
  it('"≈ 1800" vale como 1800; "sem acesso" não é número errado', () => {
    const num = TEMPLATES['corpo-silo'].campos[1]!;
    expect(parseMedida('≈ 1800')).toBe(1800);
    expect(parseMedida('≈1800,5')).toBe(1800.5);
    expect(numeroInvalido(num, 'sem acesso')).toBe(false);
    expect(numeroInvalido(num, 'Sem acesso')).toBe(false);
    expect(numeroInvalido(num, '≈ 1800')).toBe(false);
    expect(numeroInvalido(num, 'uns 2 m')).toBe(true);
    expect(numeroAmbiguo(num, '≈ 12.450')).toBe(true);
    expect(ehSemAcesso('sem acesso')).toBe(true);
    expect(ehSemAcesso('')).toBe(false);
  });

  it('põe e tira o "≈" sem perder o que foi digitado', () => {
    expect(comEstimado('1800', true)).toBe('≈ 1800');
    expect(comEstimado('≈ 1800', true)).toBe('≈ 1800');
    expect(comEstimado('≈ 1800', false)).toBe('1800');
    expect(comEstimado('600 × 300', true)).toBe('≈ 600 × 300');
    expect(comEstimado('', true)).toBe('');
    expect(ehEstimado('≈ 1800')).toBe(true);
    expect(ehEstimado('1800')).toBe(false);
  });

  it('Ø pelo perímetro: perímetro ÷ π, em mm inteiro', () => {
    expect(diametroDoPerimetro('6000')).toBe(1910);
    expect(diametroDoPerimetro('≈ 6000')).toBe(1910);
    expect(diametroDoPerimetro('6000,5')).toBe(1910);
    expect(diametroDoPerimetro('')).toBeNull();
    expect(diametroDoPerimetro('0')).toBeNull();
    expect(diametroDoPerimetro('trena curta')).toBeNull();
  });

  it('letra no desenho: falta, medida ou cinza (sem acesso / não tem)', () => {
    expect(estadoDaCota(undefined, undefined, undefined)).toBe('falta');
    expect(estadoDaCota('  ', undefined, undefined)).toBe('falta');
    expect(estadoDaCota('≈ 1800', undefined, undefined)).toBe('medida');
    expect(estadoDaCota(undefined, '6000', undefined)).toBe('medida');
    expect(estadoDaCota('sem acesso', undefined, undefined)).toBe('cinza');
    expect(estadoDaCota(undefined, undefined, 'naoTem')).toBe('cinza');
  });
});

const croqui: ItemPcm = {
  id: 'area-2:20:exterior',
  origem: 'deduzido',
  linha: null,
  nome: 'MEDIDAS EXTERNAS',
  especificacao: '',
  quantidade: '',
  tipo: 'corpo-aeroseparador',
};

const med = (m: Partial<Medicao>): Medicao => ({
  itemId: croqui.id,
  valores: {},
  conferencia: {},
  observacao: '',
  atualizadaEm: '2026-10-26T13:05:00.000Z',
  ...m,
});

describe('croqui no progresso e na planilha', () => {
  it('o Ø medido pelo perímetro, "sem acesso" e "não tem" contam como feitos', () => {
    expect(progressoItem(croqui, undefined)).toEqual({
      preenchidos: 0,
      total: 6,
      divergencias: 0,
    });
    const m = med({
      valores: { diametroPerimetro: '6000', alturaCone: '≈ 1800', alimentacao: 'sem acesso' },
      conferencia: { saidaGrossos: 'naoTem' },
    });
    expect(progressoItem(croqui, m)).toEqual({ preenchidos: 4, total: 6, divergencias: 0 });
  });

  it('coluna Medido: letra — cota, perímetro com a conta, "≈" e "sem acesso"', () => {
    const m = med({
      valores: {
        diametroPerimetro: '6000',
        alturaCilindro: '2400',
        alturaCone: '≈ 1800',
        saidaFinos: 'sem acesso',
        alimentacao: '300 × 300',
      },
      conferencia: { saidaGrossos: 'naoTem' },
    });
    expect(textoMedido(croqui, m)).toBe(
      'A — Ø do corpo: 1910 mm (perímetro 6000 mm ÷ π); ' +
        'B — Altura do cilindro: 2400 mm; ' +
        'C — Altura do cone: ≈ 1800 mm; ' +
        'D — Ø da saída de finos: sem acesso; ' +
        'E — Ø do retorno de grossos: não se aplica; ' +
        'F — Alimentação (em cima): 300 × 300',
    );
  });

  it('Ø digitado e perímetro: os dois saem; perímetro estimado dá Ø estimado', () => {
    expect(
      textoMedido(croqui, med({ valores: { diametro: '1900', diametroPerimetro: '6000' } })),
    ).toBe('A — Ø do corpo: 1900 mm (perímetro 6000 mm)');
    expect(textoMedido(croqui, med({ valores: { diametroPerimetro: '≈ 6000' } }))).toBe(
      'A — Ø do corpo: ≈ 1910 mm (perímetro ≈ 6000 mm ÷ π)',
    );
    // perímetro que não é número: sai como foi digitado, nunca some
    expect(textoMedido(croqui, med({ valores: { diametroPerimetro: 'trena curta' } }))).toBe(
      'A — Ø do corpo: perímetro trena curta mm',
    );
  });
});
