import { describe, expect, it } from 'vitest';
import { anotar, pendentesNoDiario, riscar, type Armazenamento } from '../../src/db/diario.ts';
import {
  avisosDoItem,
  comConferencia,
  comObservacao,
  comValor,
  deltaDoCampo,
  itemDiverge,
  numeroAmbiguo,
  numeroInvalido,
} from '../../src/dominio/medicao.ts';
import { TEMPLATES } from '../../src/dominio/templates/registro.ts';
import type { ItemPcm } from '../../src/dominio/tipos.ts';

const tapete: ItemPcm = {
  id: 'a:1:2',
  origem: 'pcm',
  linha: 2,
  nome: 'TAPETE',
  especificacao: '26" 3/16 X 1/16 2 LONAS',
  quantidade: '23 METROS',
  tipo: 'tapete',
};
const campo = (id: string) => TEMPLATES.tapete.campos.find((c) => c.id === id)!;

describe('edição da medição', () => {
  it('guarda o texto como digitado; vazio apaga o campo', () => {
    let m = comValor(undefined, tapete.id, 'largura', '658,5');
    expect(m.valores).toEqual({ largura: '658,5' });
    m = comValor(m, tapete.id, 'lonas', '2');
    m = comValor(m, tapete.id, 'largura', '');
    expect(m.valores).toEqual({ lonas: '2' });
    expect(m.itemId).toBe(tapete.id);
  });

  it('✓/✗ por campo; tocar de novo desmarca', () => {
    let m = comConferencia(undefined, tapete.id, 'largura', 'diverge');
    expect(m.conferencia).toEqual({ largura: 'diverge' });
    expect(itemDiverge(tapete, m)).toBe(true);
    m = comConferencia(m, tapete.id, 'largura', 'confere');
    expect(m.conferencia).toEqual({ largura: 'confere' });
    m = comConferencia(m, tapete.id, 'largura', 'confere');
    expect(m.conferencia).toEqual({});
    expect(itemDiverge(tapete, m)).toBe(false);
  });

  it('não perde valores ao mudar observação', () => {
    const m = comObservacao(comValor(undefined, tapete.id, 'lonas', '2'), tapete.id, 'emenda');
    expect(m).toMatchObject({ valores: { lonas: '2' }, observacao: 'emenda' });
  });

  it('Δ contra o valor do PCM (largura em polegadas → mm)', () => {
    expect(deltaDoCampo(campo('largura'), tapete, '658,4')).toBe(-2);
    expect(deltaDoCampo(campo('largura'), tapete, '')).toBeNull();
    expect(deltaDoCampo(campo('coberturas'), tapete, '3/16')).toBeNull(); // campo de texto
    expect(deltaDoCampo(campo('centroLd'), tapete, '12450')).toBeNull(); // sem valor no PCM
  });

  it('avisa número inválido em campo numérico', () => {
    expect(numeroInvalido(campo('largura'), '65O')).toBe(true);
    expect(numeroInvalido(campo('largura'), '650,5')).toBe(false);
    expect(numeroInvalido(campo('coberturas'), 'abc')).toBe(false);
    expect(deltaDoCampo(campo('largura'), tapete, '65O')).toBeNull(); // sem Δ falso
  });

  it('"12.450" é ambíguo (milhar ou decimal): avisa em vez de adivinhar', () => {
    expect(numeroAmbiguo(campo('centroLd'), '12.450')).toBe(true);
    expect(numeroAmbiguo(campo('centroLd'), '12450')).toBe(false);
    expect(numeroAmbiguo(campo('centroLd'), '38.14')).toBe(false);
    expect(numeroAmbiguo(campo('centroLd'), '0.125')).toBe(false);
    expect(numeroAmbiguo(campo('coberturas'), '12.450')).toBe(false);
  });

  it('avisa LD ≠ LE no tapete', () => {
    let m = comValor(undefined, tapete.id, 'centroLd', '12450');
    expect(avisosDoItem(tapete, m)).toEqual([]);
    m = comValor(m, tapete.id, 'centroLe', '12480');
    expect(avisosDoItem(tapete, m)).toEqual([
      'LD e LE diferentes: 30 mm. Confira alinhamento e esticador.',
    ]);
    m = comValor(m, tapete.id, 'centroLe', '12450');
    expect(avisosDoItem(tapete, m)).toEqual([]);
  });
});

describe('diário em localStorage', () => {
  function memoria(): Armazenamento {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
      key: (i) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    };
  }

  it('anota na hora, lista e risca depois de gravado', () => {
    const area = memoria();
    area.setItem('tema', 'escuro'); // outras chaves não entram
    anotar('medicao:a:1', { valores: { largura: '658' } }, area);
    anotar('medicao:a:2', { valores: { lonas: '2' } }, area);
    expect(pendentesNoDiario(area)).toEqual([
      ['medicao:a:1', { valores: { largura: '658' } }],
      ['medicao:a:2', { valores: { lonas: '2' } }],
    ]);
    riscar('medicao:a:1', area);
    expect(pendentesNoDiario(area).map(([k]) => k)).toEqual(['medicao:a:2']);
  });

  it('armazenamento bloqueado ou corrompido não derruba o app', () => {
    const quebrado: Armazenamento = {
      getItem: () => '{corrompido',
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
      key: () => 'diario:x',
      length: 1,
    };
    expect(() => anotar('x', { a: 1 }, quebrado)).not.toThrow();
    expect(() => riscar('x', quebrado)).not.toThrow();
    expect(pendentesNoDiario(quebrado)).toEqual([]);
    expect(pendentesNoDiario(null)).toEqual([]);
  });
});
