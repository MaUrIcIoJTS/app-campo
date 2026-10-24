import { describe, expect, it } from 'vitest';
import {
  calcularDelta,
  formatarDelta,
  formatarNumero,
  parseNumero,
  parsePolegadas,
  polegadasParaMm,
} from '../../src/dominio/numeros.ts';

describe('parseNumero', () => {
  it.each([
    ['38,14', 38.14],
    ['38.14', 38.14],
    ['63', 63],
    [' 63 mm', 63],
    ['1.234,5', 1234.5],
    ['-0,5', -0.5],
    [',5', 0.5],
    [7.5, 7.5],
  ])('%j → %d', (entrada, esperado) => {
    expect(parseNumero(entrada)).toBe(esperado);
  });

  it.each(['', '?', 'INDEFINIDO', 'abc', null, undefined, NaN])('%j → null', (entrada) => {
    expect(parseNumero(entrada as string)).toBeNull();
  });
});

describe('polegadas', () => {
  it.each([
    ['26"', 26],
    ['3/16', 0.1875],
    ['1 1/2"', 1.5],
    ['1/4"', 0.25],
    ['12', 12],
  ])('parsePolegadas(%j) = %d', (entrada, esperado) => {
    expect(parsePolegadas(entrada)).toBeCloseTo(esperado, 6);
  });

  it('converte larguras de tapete do PCM para mm', () => {
    expect(polegadasParaMm(26)).toBe(660.4);
    expect(polegadasParaMm(30)).toBe(762);
    expect(polegadasParaMm(12)).toBe(304.8);
  });

  it('fração com zero no denominador não quebra', () => {
    expect(parsePolegadas('1/0')).toBeNull();
  });
});

describe('calcularDelta', () => {
  it('medido − PCM, aceitando vírgula', () => {
    expect(calcularDelta('64,5', 63)).toBe(1.5);
    expect(calcularDelta('62', '63')).toBe(-1);
    expect(calcularDelta('660,4', 660.4)).toBe(0);
  });

  it('sem ruído de ponto flutuante', () => {
    expect(calcularDelta('26,2', 26)).toBe(0.2);
  });

  it('não calcula quando um dos lados não é número', () => {
    expect(calcularDelta('SNA 515', 63)).toBeNull();
    expect(calcularDelta('', 63)).toBeNull();
    expect(calcularDelta('63', null)).toBeNull();
  });
});

describe('formatação pt-BR', () => {
  it('usa vírgula e sinal no Δ', () => {
    expect(formatarNumero(660.4)).toBe('660,4');
    expect(formatarNumero(1234.5)).toBe('1234,5');
    expect(formatarDelta(1.5)).toBe('+1,5');
    expect(formatarDelta(-0.25)).toBe('−0,25');
    expect(formatarDelta(0)).toBe('0');
  });
});
