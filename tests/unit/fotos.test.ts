import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { IDBPTransaction } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { banco, fecharBanco } from '../../src/db/banco.ts';
import type { Foto } from '../../src/db/esquema.ts';
import { apagarFoto, carregarDados, fotosDosAlvos, salvarFoto } from '../../src/db/repositorio.ts';
import {
  avisoDeEspaco,
  dimensoesReduzidas,
  emOrdem,
  idNovaFoto,
  situacaoEspaco,
  TAMANHO_TIPICO_FOTO,
} from '../../src/dominio/fotos.ts';
import {
  anotarPendencia,
  fotosPerdidasAoAbrir,
  riscarPendencias,
} from '../../src/ui/fotosPendentes.ts';
import type { Armazenamento } from '../../src/db/diario.ts';
import { memoria } from './memoria.ts';

// Compressão é DOM (canvas): nos testes de Node, devolve blobs prontos.
const comprimir = vi.hoisted(() => ({
  comprimirFoto: vi.fn(async (_arquivo: Blob) => ({
    blob: new Blob(['grande'], { type: 'image/jpeg' }),
    miniatura: new Blob(['mini'], { type: 'image/jpeg' }),
    largura: 1600,
    altura: 1200,
  })),
}));
vi.mock('../../src/ui/comprimir.ts', async (original) => ({
  ...(await original<typeof import('../../src/ui/comprimir.ts')>()),
  comprimirFoto: comprimir.comprimirFoto,
}));
const {
  apagar,
  cameraAbrindo,
  carregarFotosPerdidas,
  dispensarAviso,
  lerEstadoFotos,
  ouvirFotos,
  receberFotos,
  secaoDe,
  tentarDeNovo,
  textoDaFalha,
} = await import('../../src/ui/fotos.ts');
const { FotoIlegivel } = await import('../../src/ui/comprimir.ts');

let pendentes: Armazenamento;

beforeEach(async () => {
  await fecharBanco();
  globalThis.indexedDB = new IDBFactory();
  pendentes = memoria();
  vi.stubGlobal('localStorage', pendentes);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  comprimir.comprimirFoto.mockClear();
  for (const secao of [...lerEstadoFotos().falhas.keys()]) dispensarAviso(secao);
});

/** Quantas fotos ainda estão anotadas como "esperando o banco". */
const anotadas = () => JSON.parse(pendentes.getItem('fotos-pendentes') ?? '[]').length as number;

const destino = (alvoId: string, daPlaca = false) => ({ alvoId, equipamentoId: 'eq:1', daPlaca });

const foto = (id: string, alvoId: string, extra: Partial<Foto> = {}): Foto => ({
  id,
  alvoId,
  blob: new Blob([`jpeg ${id}`], { type: 'image/jpeg' }),
  criadaEm: '2026-10-24T10:00:00.000Z',
  largura: 1600,
  altura: 1200,
  ...extra,
});

/** O banco passa a recusar gravar fotos, como o IndexedDB com o celular cheio. */
async function simularBancoCheio() {
  const db = await banco();
  const transaction = db.transaction.bind(db) as (
    ...a: unknown[]
  ) => IDBPTransaction<unknown, ['fotos'], 'readwrite'>;
  return vi.spyOn(db, 'transaction').mockImplementation(((...args: unknown[]) => {
    const tx = transaction(...args);
    if (args[0] === 'fotos' && args[1] === 'readwrite')
      vi.spyOn(tx.store, 'put').mockRejectedValue(
        new DOMException('Sem espaço', 'QuotaExceededError'),
      );
    return tx;
  }) as unknown as typeof db.transaction);
}

const arquivo = (nome: string) => new File(['bruto'], nome, { type: 'image/jpeg' });

describe('tamanho da foto gravada', () => {
  it('reduz o maior lado para 1600 mantendo a proporção (paisagem e retrato)', () => {
    expect(dimensoesReduzidas(4000, 3000, 1600)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesReduzidas(3000, 4000, 1600)).toEqual({ largura: 1200, altura: 1600 });
    expect(dimensoesReduzidas(8160, 6120, 1600)).toEqual({ largura: 1600, altura: 1200 }); // 50 MP
  });

  it('não aumenta foto pequena e nunca chega a 0 px', () => {
    expect(dimensoesReduzidas(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
    expect(dimensoesReduzidas(1600, 1600, 1600)).toEqual({ largura: 1600, altura: 1600 });
    expect(dimensoesReduzidas(20000, 3, 1600)).toEqual({ largura: 1600, altura: 1 });
  });
});

describe('espaço no celular', () => {
  const livre = (bytes: number) => ({ usage: 1e9, quota: 1e9 + bytes });

  it('estima quantas fotos cabem e avisa quando é pouco', () => {
    expect(situacaoEspaco(livre(2000 * TAMANHO_TIPICO_FOTO))).toEqual({
      fotosQueCabem: 2000,
      nivel: 'ok',
    });
    expect(situacaoEspaco(livre(150 * TAMANHO_TIPICO_FOTO))?.nivel).toBe('pouco');
    expect(situacaoEspaco(livre(10 * TAMANHO_TIPICO_FOTO))?.nivel).toBe('cheio');
    expect(situacaoEspaco({ usage: 5e9, quota: 1e9 })).toEqual({
      fotosQueCabem: 0,
      nivel: 'cheio',
    });
  });

  it('aviso curto só quando falta espaço; sem números do navegador, nada', () => {
    expect(avisoDeEspaco(situacaoEspaco(livre(2000 * TAMANHO_TIPICO_FOTO)))).toBeNull();
    expect(avisoDeEspaco(situacaoEspaco(livre(40 * TAMANHO_TIPICO_FOTO)))).toBe(
      'Pouco espaço no celular: cabem ~40 fotos.',
    );
    expect(avisoDeEspaco(situacaoEspaco(livre(TAMANHO_TIPICO_FOTO)))).toBe(
      'Celular quase sem espaço: cabe ~1 foto. Libere espaço no celular.',
    );
    expect(situacaoEspaco({})).toBeNull();
    expect(situacaoEspaco({ usage: 0, quota: 0 })).toBeNull();
    expect(avisoDeEspaco(null)).toBeNull();
  });
});

describe('ids e ordem', () => {
  it('ids diferentes mesmo no mesmo milissegundo; ordem = hora em que foi tirada', () => {
    const a = idNovaFoto(1000, 0.1);
    const b = idNovaFoto(1000, 0.2);
    expect(a).not.toBe(b);
    const fotos = [
      foto('b', 'x', { criadaEm: '2026-10-24T10:00:02.000Z' }),
      foto('a', 'x', { criadaEm: '2026-10-24T10:00:01.000Z' }),
      foto('c', 'x', { criadaEm: '2026-10-24T10:00:01.000Z' }),
    ];
    expect(emOrdem(fotos).map((f) => f.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('fotos pendentes (o app fechou antes de gravar)', () => {
  it('o que sobrou anotado vira aviso por seção, uma vez só, ao reabrir', () => {
    const s = memoria();
    anotarPendencia({ secao: 'eq:1:5', equipamentoId: 'eq:1', tipo: 'camera' }, s, 1_000_000);
    anotarPendencia({ secao: 'eq:1:5', equipamentoId: 'eq:1', tipo: 'foto' }, s, 1_000_000);
    anotarPendencia({ secao: 'eq:1:6#placa', equipamentoId: 'eq:1', tipo: 'foto' }, s, 1_000_000);
    expect([...fotosPerdidasAoAbrir(s, 1_060_000)]).toEqual([
      ['eq:1:5', { n: 2, equipamentoId: 'eq:1' }],
      ['eq:1:6#placa', { n: 1, equipamentoId: 'eq:1' }],
    ]);
    expect(fotosPerdidasAoAbrir(s, 1_061_000).size).toBe(0); // já avisou
  });

  it('riscada não avisa; câmera aberta há mais de 15 min e lixo não contam', () => {
    const s = memoria();
    const a = anotarPendencia({ secao: 'x', equipamentoId: 'eq:1', tipo: 'foto' }, s, 0);
    anotarPendencia({ secao: 'y', equipamentoId: 'eq:1', tipo: 'camera' }, s, 0);
    anotarPendencia({ secao: 'z', equipamentoId: 'eq:1', tipo: 'foto' }, s, 0);
    riscarPendencias([a], s);
    // 16 min depois: a câmera não é desta sessão; a foto recebida e não gravada continua.
    expect([...fotosPerdidasAoAbrir(s, 16 * 60_000).keys()]).toEqual(['z']);
    s.setItem('fotos-pendentes', '{lixo');
    expect(fotosPerdidasAoAbrir(s, 0).size).toBe(0);
    expect(fotosPerdidasAoAbrir(null).size).toBe(0);
  });

  it('carregadas ao abrir: o aviso diz quantas e o que fazer', () => {
    carregarFotosPerdidas(new Map([['eq:1:5', { n: 2, equipamentoId: 'eq:1' }]]));
    const f = lerEstadoFotos().falhas.get('eq:1:5')!;
    expect(f.destino).toEqual(destino('eq:1:5'));
    expect(textoDaFalha(f)).toMatch(/^2 fotos não foram salvas: o app fechou antes de gravar/);
    expect(textoDaFalha(f)).toMatch(/Tire de novo/);
  });
});

describe('fotos no banco', () => {
  it('grava, lê só as do equipamento aberto, conta sem carregar blobs e apaga', async () => {
    await salvarFoto(foto('f1', 'eq:10', { miniatura: new Blob(['mini']), daPlaca: true }));
    await salvarFoto(foto('f2', 'eq:10:12'));
    await salvarFoto(foto('f3', 'outro:5'));

    const doEq = await fotosDosAlvos(['eq:10', 'eq:10:12']);
    expect(doEq.map((f) => f.id).sort()).toEqual(['f1', 'f2']);
    const f1 = doEq.find((f) => f.id === 'f1')!;
    expect(await f1.blob.text()).toBe('jpeg f1');
    expect(await f1.miniatura?.text()).toBe('mini');
    expect(f1.daPlaca).toBe(true);

    const dados = await carregarDados();
    expect([...dados.fotosPorAlvo]).toEqual(
      expect.arrayContaining([
        ['eq:10', 1],
        ['eq:10:12', 1],
        ['outro:5', 1],
      ]),
    );

    await apagarFoto('f1');
    expect((await fotosDosAlvos(['eq:10'])).length).toBe(0);
    expect((await carregarDados()).fotosPorAlvo.has('eq:10')).toBe(false);
  });

  it('foto gravada antes da miniatura existir (só blob) continua abrindo', async () => {
    const db = await banco();
    await db.put('fotos', foto('antiga', 'eq:10')); // formato da versão 1, sem campos novos
    const [f] = await fotosDosAlvos(['eq:10']);
    expect(f?.miniatura).toBeUndefined();
    expect(await f?.blob.text()).toBe('jpeg antiga');
  });

  it('banco cheio: salvarFoto rejeita (a tela não mostra a foto como salva)', async () => {
    await simularBancoCheio();
    await expect(salvarFoto(foto('f1', 'eq:10'))).rejects.toThrow('Sem espaço');
  });
});

describe('receberFotos (comprimir → banco → tela)', () => {
  it('só conta e mostra depois que o banco confirma; risca a anotação de cada foto', async () => {
    const contarFoto = vi.fn();
    const vistas: string[] = [];
    const parar = ouvirFotos((m) => {
      vistas.push(`${m.tipo}:${m.foto.alvoId}:${m.foto.daPlaca ? 'placa' : '-'}`);
    });
    const abertura = cameraAbrindo(secaoDe('eq:1:12', true), 'eq:1');
    expect(anotadas()).toBe(1);
    const gravando = receberFotos(
      destino('eq:1:12', true),
      [arquivo('a.jpg'), arquivo('b.jpg')],
      abertura,
      contarFoto,
    );
    expect(anotadas()).toBe(2); // a câmera saiu; as 2 fotos ficam até o banco confirmar
    expect(contarFoto).not.toHaveBeenCalled();
    await gravando;
    parar();

    expect(comprimir.comprimirFoto).toHaveBeenCalledTimes(2);
    expect(contarFoto).toHaveBeenCalledTimes(2);
    expect(vistas).toEqual(['gravada:eq:1:12:placa', 'gravada:eq:1:12:placa']);
    expect(anotadas()).toBe(0);
    const gravadas = await fotosDosAlvos(['eq:1:12']);
    expect(gravadas).toHaveLength(2);
    expect(gravadas.every((f) => f.blob.type === 'image/jpeg' && f.largura === 1600)).toBe(true);
    expect(await gravadas[0]!.miniatura?.text()).toBe('mini');
    expect(lerEstadoFotos().andamento.size).toBe(0);
  });

  it('uma foto por vez no app inteiro, mesmo com levas em itens diferentes', async () => {
    let aoMesmoTempo = 0;
    let maximo = 0;
    comprimir.comprimirFoto.mockImplementation(async () => {
      maximo = Math.max(maximo, ++aoMesmoTempo);
      await new Promise((r) => setTimeout(r, 5));
      aoMesmoTempo--;
      return {
        blob: new Blob(['grande'], { type: 'image/jpeg' }),
        miniatura: new Blob(['mini'], { type: 'image/jpeg' }),
        largura: 1600,
        altura: 1200,
      };
    });
    const contarFoto = vi.fn();
    await Promise.all([
      receberFotos(destino('eq:1:5'), [arquivo('a'), arquivo('b')], undefined, contarFoto),
      receberFotos(destino('eq:1:6'), [arquivo('c')], undefined, contarFoto),
      receberFotos(destino('eq:1:7'), [arquivo('d'), arquivo('e')], undefined, contarFoto),
    ]);
    expect(maximo).toBe(1);
    expect(contarFoto).toHaveBeenCalledTimes(5);
  });

  it('sem espaço: nada aparece, para a leva, guarda as fotos e "Tentar de novo" grava depois', async () => {
    const cheio = await simularBancoCheio();
    const contarFoto = vi.fn();
    const vistas = vi.fn();
    const parar = ouvirFotos(vistas);
    await receberFotos(
      destino('eq:1:5'),
      [arquivo('a.jpg'), arquivo('b.jpg'), arquivo('c.jpg')],
      undefined,
      contarFoto,
    );

    expect(comprimir.comprimirFoto).toHaveBeenCalledTimes(1); // parou na primeira
    expect(contarFoto).not.toHaveBeenCalled();
    expect(vistas).not.toHaveBeenCalled();
    const { andamento, falhas } = lerEstadoFotos();
    expect(andamento.size).toBe(0); // sem "Salvando…" preso
    const f = falhas.get('eq:1:5')!;
    expect(f.refazer).toHaveLength(3);
    expect(textoDaFalha(f)).toMatch(/^Celular sem espaço: 3 fotos não foram salvas\./);
    expect(anotadas()).toBe(3); // se o app fechar agora, o aviso volta ao reabrir

    cheio.mockRestore(); // liberou espaço
    await tentarDeNovo('eq:1:5', contarFoto);
    parar();
    expect(contarFoto).toHaveBeenCalledTimes(3);
    expect(vistas).toHaveBeenCalledTimes(3);
    expect(lerEstadoFotos().falhas.size).toBe(0);
    expect(await fotosDosAlvos(['eq:1:5'])).toHaveLength(3);
    expect(anotadas()).toBe(0);
  });

  it('"Descartar" tira o aviso e as anotações das fotos que não gravaram', async () => {
    await simularBancoCheio();
    await receberFotos(destino('eq:1:5'), [arquivo('a.jpg')], undefined, vi.fn());
    expect(anotadas()).toBe(1);
    dispensarAviso('eq:1:5');
    expect(lerEstadoFotos().falhas.size).toBe(0);
    expect(anotadas()).toBe(0);
  });

  it('imagem que o navegador não abre: mensagem própria, segue para a próxima', async () => {
    comprimir.comprimirFoto.mockRejectedValueOnce(new FotoIlegivel());
    const contarFoto = vi.fn();
    await receberFotos(
      destino('eq:1:11'),
      [arquivo('a.heic'), arquivo('b.jpg')],
      undefined,
      contarFoto,
    );
    expect(contarFoto).toHaveBeenCalledTimes(1);
    const f = lerEstadoFotos().falhas.get('eq:1:11')!;
    expect(f.refazer).toHaveLength(0); // tentar de novo não adianta
    expect(textoDaFalha(f)).toBe(
      'Não consegui abrir uma imagem. Tire a foto pela câmera (“Tirar foto”).',
    );
    expect(anotadas()).toBe(0);
  });

  it('apagar: some da contagem e da tela só depois do banco', async () => {
    await salvarFoto(foto('f1', 'eq:12'));
    const contarFoto = vi.fn();
    const vistas: string[] = [];
    const parar = ouvirFotos((m) => vistas.push(`${m.tipo}:${m.foto.id}`));
    await apagar(foto('f1', 'eq:12'), contarFoto);
    parar();
    expect(contarFoto).toHaveBeenCalledWith('eq:12', -1);
    expect(vistas).toEqual(['apagada:f1']);
    expect(await fotosDosAlvos(['eq:12'])).toEqual([]);
  });
});
