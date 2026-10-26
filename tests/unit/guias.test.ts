import { describe, expect, it } from 'vitest';
import {
  anotadoNosTambores,
  guiaDoItem,
  guiaInicial,
  guiasDaFicha,
  guiaValida,
  proximaGuia,
} from '../../src/dominio/guias.ts';
import { valorPcm } from '../../src/dominio/medicao.ts';
import { deduzirTambores } from '../../src/dominio/pcm/parser.ts';
import { detectarTipo } from '../../src/dominio/templates/detectar.ts';
import { TEMPLATES } from '../../src/dominio/templates/registro.ts';
import type { EquipamentoPcm, ItemPcm } from '../../src/dominio/tipos.ts';

const item = (nome: string, especificacao = '', quantidade = '1 UNIDADE'): ItemPcm => ({
  id: `xa:10:${nome}`,
  origem: 'pcm',
  linha: 10,
  nome,
  especificacao,
  quantidade,
  tipo: detectarTipo(nome, especificacao),
});

/** Transportadora fictícia, como o XA-TC-01 da fixture, com os tambores deduzidos. */
function transportadora(mancais: ItemPcm[] = [item('MANCAL', 'SNA 515 EIXO 63', '4 UNIDADES')]) {
  const eq: EquipamentoPcm = {
    id: 'xa:10',
    aba: 'TESTE',
    linha: 10,
    nomeOriginal: 'TRANSPORTADORA XA-TC-01',
    nome: 'TRANSPORTADORA',
    tag: 'XA-TC-01',
    itens: [
      item('TAPETE', '26" 3/16 X 1/16 2 LONAS', '23 METROS'),
      item('ROLETE DE CARGA', '212x250x102x14x20', '39 UNIDADES'),
      item('REDUTOR', 'COROA E ROSCA 1:30'),
      item('MOTOR', '5CV 1730RPM'),
      ...mancais,
      item('ROLAMENTO', 'ROLAMENTO AUTOCOMP. ROLOS 22215 K', '4 UNIDADES'),
      item('BUCHA', 'HE 315', '4 UNIDADES'),
      item('CORREIA EM V', 'B 50', '2 UNIDADES'),
      item('CHAVE DE SEGURANÇA', 'MODELO X', '2 UNIDADES'),
    ],
  };
  return [...eq.itens, ...deduzirTambores(eq)];
}

const nomes = (itens: readonly ItemPcm[]) => itens.map((i) => i.nome);

describe('guias da ficha', () => {
  it('separa os itens da transportadora como no protótipo de campo', () => {
    const guias = guiasDaFicha(transportadora());
    expect(guias.map((g) => g.rotulo)).toEqual([
      'PCM',
      'Correia',
      'Tambores',
      'Roletes',
      'Acionamento',
      'Outros',
      'Fotos',
      'Notas',
    ]);
    const de = (id: string) => nomes(guias.find((g) => g.id === id)!.itens);
    expect(de('correia')).toEqual(['TAPETE']);
    // Os tambores primeiro; as linhas de mancal do PCM depois, para conferir código e qtd.
    expect(de('tambores')).toEqual(['TAMBOR 1', 'TAMBOR 2', 'MANCAL', 'ROLAMENTO', 'BUCHA']);
    expect(de('roletes')).toEqual(['ROLETE DE CARGA']);
    expect(de('acionamento')).toEqual(['REDUTOR', 'MOTOR', 'CORREIA EM V']);
    expect(de('outros')).toEqual(['CHAVE DE SEGURANÇA']);
    expect(de('pcm')).toHaveLength(11); // todos, inclusive os tambores deduzidos
    expect(de('notas')).toEqual([]);
  });

  it('só mostra a guia de medida que tem item; sem tambor, a guia é "Mancais"', () => {
    const exaustor = [
      item('ROTOR', 'Ø1300X345L'),
      item('MOTOR', '50CV'),
      item('MANCAL', 'SNA 517'),
    ];
    expect(guiasDaFicha(exaustor).map((g) => g.rotulo)).toEqual([
      'PCM',
      'Mancais',
      'Acionamento',
      'Outros',
      'Fotos',
      'Notas',
    ]);
  });

  it('abre na primeira guia de medida; endereço inválido cai nela também', () => {
    const guias = guiasDaFicha(transportadora());
    expect(guiaInicial(guias)).toBe('correia');
    expect(guiaValida(guias, 'roletes')).toBe('roletes');
    expect(guiaValida(guias, 'qualquer')).toBe('correia');
    expect(guiaValida(guias, undefined)).toBe('correia');
    // Equipamento sem item no PCM: abre no PCM (que diz que está vazio).
    expect(guiaInicial(guiasDaFicha([]))).toBe('pcm');
  });

  it('"Seguir" vai para a guia ao lado; Notas é a última', () => {
    const guias = guiasDaFicha(transportadora());
    expect(proximaGuia(guias, 'pcm')?.id).toBe('correia');
    expect(proximaGuia(guias, 'outros')?.id).toBe('fotos');
    expect(proximaGuia(guias, 'notas')).toBeNull();
  });

  it('todo tipo de item tem guia', () => {
    for (const tipo of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[])
      expect(guiaDoItem({ tipo })).toBeTruthy();
  });
});

describe('mancal e rolamento dentro do tambor', () => {
  const campo = (id: string) => TEMPLATES.tambor.campos.find((c) => c.id === id)!;

  it('mostra o PCM das linhas MANCAL, ROLAMENTO e BUCHA do mesmo equipamento', () => {
    const itens = transportadora();
    const tambor = itens.find((i) => i.nome === 'TAMBOR 1')!;
    expect(valorPcm(campo('mancal'), tambor, itens)).toBe('SNA 515 EIXO 63');
    expect(valorPcm(campo('rolamento'), tambor, itens)).toBe('ROLAMENTO AUTOCOMP. ROLOS 22215 K');
    expect(valorPcm(campo('bucha'), tambor, itens)).toBe('HE 315');
    // O cartão do tambor deduzido não repete a especificação: ela já está no campo Mancal.
    expect(valorPcm(campo('mancal'), tambor, itens)).toBe(tambor.especificacao);
    expect(campo('mancal').grupo).toBe('Mancal e rolamento');
  });

  it('mancais diferentes no mesmo equipamento aparecem juntos, sem repetir', () => {
    const itens = transportadora([
      item('MANCAL', 'SNA 513 EIXO 57', '2 UNIDADES'),
      item('MANCAL', 'SNA 515 EIXO 62', '2 UNIDADES'),
      item('MANCAL', 'SNA 515 EIXO 62', '2 UNIDADES'),
    ]);
    const tambor = itens.find((i) => i.tipo === 'tambor')!;
    expect(valorPcm(campo('mancal'), tambor, itens)).toBe('SNA 513 EIXO 57 / SNA 515 EIXO 62');
  });

  it('sem a linha no PCM, o campo fica sem referência (pede "Não tem" ou o valor)', () => {
    const tambor = transportadora().find((i) => i.tipo === 'tambor')!;
    expect(valorPcm(campo('bucha'), tambor, [tambor])).toBeNull();
    expect(valorPcm(campo('bucha'), tambor)).toBeNull();
  });
});

describe('linha MANCAL/ROLAMENTO/BUCHA mostra o que foi anotado nos tambores', () => {
  const itens = transportadora();
  const tambores = itens.filter((i) => i.tipo === 'tambor');
  const linha = (nome: string) => itens.find((i) => i.nome === nome)!;
  const valores: Record<string, Record<string, string>> = {
    [tambores[0]!.id]: { mancal: 'SNA 515', rolamento: '22215 K', bucha: ' ' },
    [tambores[1]!.id]: { mancal: 'SNA 513' },
  };
  const de = (id: string) => valores[id];

  it('cada linha lê o seu campo, com o nome do tambor', () => {
    expect(anotadoNosTambores(linha('MANCAL'), tambores, de)).toBe(
      'Tambor 1: SNA 515 · Tambor 2: SNA 513',
    );
    expect(anotadoNosTambores(linha('ROLAMENTO'), tambores, de)).toBe('Tambor 1: 22215 K');
  });

  it('nada anotado (ou só espaço) e linhas que não são de mancal: nada a mostrar', () => {
    expect(anotadoNosTambores(linha('BUCHA'), tambores, de)).toBeNull();
    expect(anotadoNosTambores(linha('MOTOR'), tambores, de)).toBeNull();
    expect(anotadoNosTambores(linha('MANCAL'), tambores, () => undefined)).toBeNull();
  });
});
