import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarFilaDeGravacao } from '../../src/db/salvamento.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fila de gravação automática', () => {
  it('grava 300 ms depois da última alteração, uma vez por chave', async () => {
    const fila = criarFilaDeGravacao();
    const gravadas: string[] = [];
    fila.agendar('item-1', async () => void gravadas.push('6'));
    await vi.advanceTimersByTimeAsync(100);
    fila.agendar('item-1', async () => void gravadas.push('66'));
    fila.agendar('item-2', async () => void gravadas.push('b'));
    expect(fila.estado()).toBe('salvando');
    await vi.advanceTimersByTimeAsync(299);
    expect(gravadas).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(gravadas).toEqual(['66', 'b']);
    expect(fila.estado()).toBe('salvo');
  });

  it('digitando sem parar, grava no máximo a cada 1 s', async () => {
    const fila = criarFilaDeGravacao();
    let gravacoes = 0;
    for (let t = 0; t < 1000; t += 100) {
      fila.agendar('item-1', async () => void gravacoes++);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(gravacoes).toBe(1);
  });

  it('descarregar() grava na hora (app indo para segundo plano)', async () => {
    const fila = criarFilaDeGravacao();
    const gravar = vi.fn(async () => {});
    fila.agendar('item-1', gravar);
    await fila.descarregar();
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(fila.pendentes()).toBe(0);
  });

  it('falha não perde o dado: volta para a fila e o estado vira "erro"', async () => {
    const fila = criarFilaDeGravacao();
    const estados: string[] = [];
    fila.ouvir((e) => estados.push(e));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let tentativas = 0;
    const gravar = async () => {
      tentativas++;
      if (tentativas === 1) throw new Error('QuotaExceededError');
    };
    fila.agendar('item-1', gravar);
    await vi.advanceTimersByTimeAsync(300);
    expect(fila.estado()).toBe('erro');
    expect(fila.pendentes()).toBe(1);

    await fila.descarregar();
    expect(tentativas).toBe(2);
    expect(fila.estado()).toBe('salvo');
    expect(estados).toEqual(['salvando', 'erro', 'salvo']);
  });

  it('versão nova agendada durante uma falha não é sobrescrita pela antiga', async () => {
    const fila = criarFilaDeGravacao();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gravadas: string[] = [];
    let liberar!: () => void;
    fila.agendar(
      'item-1',
      () => new Promise<void>((_, rej) => (liberar = () => rej(new Error('x')))),
    );
    const lote = fila.descarregar();
    await vi.advanceTimersByTimeAsync(0); // o lote começa a gravar (e fica pendurado)
    fila.agendar('item-1', async () => void gravadas.push('nova'));
    liberar();
    await lote;
    await fila.descarregar();
    expect(gravadas).toEqual(['nova']);
  });
});
