import { describe, expect, it } from 'vitest';
import type { Medicao } from '../../src/db/esquema.ts';
import type { Dados } from '../../src/db/repositorio.ts';
import { pendenciaDeBackup } from '../../src/ui/LinhaBackup.tsx';

const med = (itemId: string, atualizadaEm: string): Medicao => ({
  itemId,
  valores: { largura: '1' },
  conferencia: {},
  observacao: '',
  atualizadaEm,
});

function dados(ultimoBackup: Dados['ultimoBackup'], fotos = 0): Dados {
  return {
    importacao: null,
    equipamentos: [],
    itensPorEquipamento: new Map(),
    medicoes: new Map([
      ['a', med('a', '2026-10-26T08:00:00.000Z')],
      ['b', med('b', '2026-10-26T12:00:00.000Z')],
      ['c', med('c', '2026-10-26T13:00:00.000Z')],
    ]),
    notas: new Map([
      ['e', { equipamentoId: 'e', observacao: 'x', atualizadaEm: '2026-10-26T12:30:00.000Z' }],
    ]),
    fotosPorAlvo: new Map(fotos ? [['a', fotos]] : []),
    ultimoBackup,
  };
}

const h = (iso: string, horas: number) => Date.parse(iso) + horas * 3_600_000;

describe('lembrete de backup', () => {
  it('sem backup e com dados: em destaque, contando tudo', () => {
    expect(pendenciaDeBackup(dados(null, 4), Date.now())).toEqual({
      itens: 4,
      fotos: 4,
      atrasado: true,
    });
  });

  it('conta só o que mudou depois do backup; destaque depois de 4 h', () => {
    const ultimo = { em: '2026-10-26T10:00:00.000Z', fotos: 3 };
    expect(pendenciaDeBackup(dados(ultimo, 5), h(ultimo.em, 3))).toEqual({
      itens: 3,
      fotos: 2,
      atrasado: false,
    });
    expect(pendenciaDeBackup(dados(ultimo, 5), h(ultimo.em, 5)).atrasado).toBe(true);
  });

  it('nada mudou depois do backup: nunca fica em destaque', () => {
    const ultimo = { em: '2026-10-26T14:00:00.000Z', fotos: 5 };
    expect(pendenciaDeBackup(dados(ultimo, 5), h(ultimo.em, 48))).toEqual({
      itens: 0,
      fotos: 0,
      atrasado: false,
    });
  });
});
