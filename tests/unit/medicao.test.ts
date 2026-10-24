import { describe, expect, it } from 'vitest';
import {
  anotar,
  pendentesNoDiario,
  riscar,
  riscarSe,
  type Armazenamento,
} from '../../src/db/diario.ts';
import {
  avisosDoItem,
  carimbo,
  comConferencia,
  comObservacao,
  comValor,
  deltaDoCampo,
  itemDiverge,
  novaNota,
  numeroAmbiguo,
  numeroInvalido,
} from '../../src/dominio/medicao.ts';
import { progressoItem } from '../../src/dominio/progresso.ts';
import { TEMPLATES } from '../../src/dominio/templates/registro.ts';
import type { ItemPcm } from '../../src/dominio/tipos.ts';
import { memoria } from './memoria.ts';

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

  it('"não tem" conta como feito e não diverge; tocar de novo desfaz', () => {
    let m = comConferencia(undefined, tapete.id, 'centroLd', 'naoTem');
    expect(progressoItem(tapete, m).preenchidos).toBe(1);
    expect(itemDiverge(tapete, m)).toBe(false);
    m = comConferencia(m, tapete.id, 'centroLd', 'naoTem');
    expect(m.conferencia).toEqual({});
  });

  it('carimbo sempre cresce, mesmo com o relógio do celular voltando', () => {
    const t = Date.parse('2026-10-26T10:00:05.000Z');
    expect(carimbo(undefined, t)).toBe('2026-10-26T10:00:05.000Z');
    expect(carimbo('2026-10-26T10:00:00.000Z', t)).toBe('2026-10-26T10:00:05.000Z');
    // relógio voltou 5 s: ainda fica depois da versão anterior
    expect(carimbo('2026-10-26T10:00:10.000Z', t)).toBe('2026-10-26T10:00:10.001Z');
    expect(carimbo('lixo', t)).toBe('2026-10-26T10:00:05.000Z');

    const v1 = comValor(undefined, tapete.id, 'lonas', '2');
    const futuro = { ...v1, atualizadaEm: '2999-01-01T00:00:00.000Z' };
    expect(comValor(futuro, tapete.id, 'lonas', '3').atualizadaEm > futuro.atualizadaEm).toBe(true);
    const n = novaNota('a:1', 'x', {
      equipamentoId: 'a:1',
      observacao: '',
      atualizadaEm: futuro.atualizadaEm,
    });
    expect(n.atualizadaEm > futuro.atualizadaEm).toBe(true);
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

  it('sem aviso LD ≠ LE quando um lado é ambíguo ("12.450" já pergunta no campo)', () => {
    let m = comValor(undefined, tapete.id, 'centroLd', '12.450');
    m = comValor(m, tapete.id, 'centroLe', '12480');
    expect(avisosDoItem(tapete, m)).toEqual([]);
  });
});

describe('diário em localStorage', () => {
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

  it('riscarSe não apaga uma anotação mais nova que a gravada', () => {
    const area = memoria();
    const v1 = { valores: { largura: '65' } };
    const v2 = { valores: { largura: '658' } };
    anotar('medicao:a:1', v1, area);
    anotar('medicao:a:1', v2, area); // técnico continuou digitando enquanto v1 gravava
    riscarSe('medicao:a:1', v1, area); // v1 chegou ao banco
    expect(pendentesNoDiario(area)).toEqual([['medicao:a:1', v2]]);
    riscarSe('medicao:a:1', { valores: { largura: '658' } }, area); // v2 chegou
    expect(pendentesNoDiario(area)).toEqual([]);
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
    expect(() => riscarSe('x', { a: 1 }, quebrado)).not.toThrow();
    expect(pendentesNoDiario(quebrado)).toEqual([]);
    expect(pendentesNoDiario(null)).toEqual([]);
  });
});
