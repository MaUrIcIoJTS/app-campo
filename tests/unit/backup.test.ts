import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fecharBanco } from '../../src/db/banco.ts';
import { VERSAO_BANCO, type Foto, type Medicao } from '../../src/db/esquema.ts';
import {
  gravarRestauracao,
  DadosMudaramDuranteRestauracao,
  impressaoDe,
  lerCopias,
  salvarFoto,
  salvarMedicao,
  lerTudo,
  type TudoDoBanco,
} from '../../src/db/repositorio.ts';
import { lerPcm } from '../../src/dominio/pcm/parser.ts';
import { registrosDoPcm } from '../../src/dominio/reimportacao.ts';
import { gerarBackup } from '../../src/exportar/backup.ts';
import { BackupInvalido, lerBackup, MENSAGEM, separarJson } from '../../src/exportar/lerBackup.ts';

import { memoria } from './memoria.ts';

const FIXTURE = 'tests/fixtures/pcm-ficticio.xls';

beforeEach(async () => {
  await fecharBanco();
  globalThis.indexedDB = new IDBFactory();
});

/** Aparelho "novo": outro banco, vazio. */
async function outroAparelho() {
  await fecharBanco();
  globalThis.indexedDB = new IDBFactory();
}

/** Bytes pseudoaleatórios (determinísticos) com cara de JPEG. */
function jpeg(tamanho: number, semente: number): Blob {
  const b = new Uint8Array(tamanho);
  let x = semente;
  for (let i = 0; i < tamanho; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    b[i] = x >>> 24;
  }
  b.set([0xff, 0xd8, 0xff], 0);
  return new Blob([b], { type: 'image/jpeg' });
}

function conteudo(): TudoDoBanco {
  const arquivo = readFileSync(FIXTURE);
  const { equipamentos, itens } = registrosDoPcm(lerPcm(arquivo), 'imp-1');
  const [i1, i2, i3] = itens;
  const medicoes: Medicao[] = [
    {
      itemId: i1!.id,
      valores: { largura: '660,5', lonas: '2' },
      conferencia: { largura: 'confere', lonas: 'diverge', espessura: 'naoTem' },
      // aspas, barra invertida, quebra de linha, acentos e emoji: escapes no meio das fatias
      observacao: 'Emenda "nova" \\ lado LD\nção ✓ 🔧 ñ',
      atualizadaEm: '2026-10-26T13:05:00.000Z',
    },
    {
      itemId: i2!.id,
      valores: {},
      conferencia: { potencia: 'confere' },
      observacao: '',
      atualizadaEm: '2026-10-26T13:06:00.000Z',
    },
  ];
  const fotos: Foto[] = [
    {
      id: 'foto-1',
      alvoId: i1!.id,
      blob: jpeg(40_000, 1),
      miniatura: jpeg(3_000, 2),
      criadaEm: '2026-10-26T13:10:00.000Z',
      largura: 1600,
      altura: 1200,
    },
    {
      id: 'foto-2',
      alvoId: i3!.id,
      blob: jpeg(35_001, 3),
      miniatura: jpeg(2_999, 4),
      criadaEm: '2026-10-26T13:11:00.000Z',
      largura: 1200,
      altura: 1600,
      daPlaca: true,
    },
    {
      // foto antiga, sem miniatura
      id: 'foto-3',
      alvoId: equipamentos[0]!.id,
      blob: jpeg(20_002, 5),
      criadaEm: '2026-10-26T13:12:00.000Z',
      largura: 1600,
      altura: 900,
    },
  ];
  return {
    importacaoAtual: 'imp-1',
    importacoes: [
      {
        id: 'imp-1',
        nomeArquivo: 'pcm-ficticio.xls',
        importadaEm: '2026-10-25T10:00:00.000Z',
        tamanho: arquivo.length,
        abas: ['AREA 1', 'SECAGEM E CLASSIFICAÇÃO'],
        arquivo: new Blob([arquivo], { type: 'application/vnd.ms-excel' }),
      },
    ],
    equipamentos: [...equipamentos],
    itens: [...itens],
    medicoes,
    notas: [
      {
        equipamentoId: equipamentos[2]!.id,
        observacao: 'Proteção "solta"',
        atualizadaEm: '2026-10-26T13:00:00.000Z',
      },
    ],
    fotos,
  };
}

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/** Compara tudo, inclusive os bytes e o tipo dos blobs (fotos, miniaturas, arquivo do PCM). */
async function comparar(a: TudoDoBanco, b: TudoDoBanco) {
  const semBlobs = (t: TudoDoBanco) => ({
    ...t,
    importacoes: t.importacoes.map(({ arquivo: _a, ...r }) => r),
    fotos: [...t.fotos]
      .sort((x, y) => (x.id < y.id ? -1 : 1))
      .map(({ blob: _b, miniatura, ...r }) => ({ ...r, temMiniatura: !!miniatura })),
    medicoes: [...t.medicoes].sort((x, y) => (x.itemId < y.itemId ? -1 : 1)),
  });
  expect(semBlobs(b)).toEqual(semBlobs(a));
  const porId = new Map(b.fotos.map((f) => [f.id, f]));
  for (const f of a.fotos) {
    const g = porId.get(f.id)!;
    expect(await bytes(g.blob)).toEqual(await bytes(f.blob));
    expect(g.blob.type).toBe(f.blob.type);
    if (f.miniatura) expect(await bytes(g.miniatura!)).toEqual(await bytes(f.miniatura));
    else expect(g.miniatura).toBeUndefined();
  }
  expect(await bytes(b.importacoes[0]!.arquivo)).toEqual(await bytes(a.importacoes[0]!.arquivo));
  expect(b.importacoes[0]!.arquivo.type).toBe(a.importacoes[0]!.arquivo.type);
}

const backupDe = (t: TudoDoBanco) =>
  gerarBackup(t, {
    criadoEm: new Date('2026-10-26T14:30:00Z'),
    esquemaDb: VERSAO_BANCO,
    app: '0.1.0',
  });

describe('backup → outro aparelho → restaurar', () => {
  it('medições, observações, PCM e fotos voltam iguais (inclusive os bytes)', async () => {
    const original = conteudo();
    await gravarRestauracao(original);
    const noBanco = await lerTudo();
    await comparar(original, noBanco);

    const progresso: [number, number][] = [];
    const arquivo = await gerarBackup(noBanco, {
      criadoEm: new Date(),
      esquemaDb: VERSAO_BANCO,
      app: '0.1.0',
      aoProgredir: (f, t) => progresso.push([f, t]),
    });
    expect(progresso).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(arquivo.type).toBe('application/json');

    await outroAparelho();
    expect((await lerTudo()).equipamentos).toHaveLength(0);
    const lido = await lerBackup(arquivo);
    expect(lido.resumo).toEqual({
      importacoes: 1,
      equipamentos: original.equipamentos.length,
      itens: original.itens.length,
      medicoes: 2,
      notas: 1,
      fotos: 3,
    });
    await gravarRestauracao(lido.tudo);
    await comparar(original, await lerTudo());
  });

  it('o arquivo é JSON válido, com o cabeçalho no começo e uma foto por linha', async () => {
    const texto = await (await backupDe(conteudo())).text();
    const json = JSON.parse(texto);
    expect(json).toMatchObject({
      formato: 'levantamento-pcm-backup',
      versao: 1,
      esquemaDb: VERSAO_BANCO,
      app: '0.1.0',
      importacaoAtual: 'imp-1',
      resumo: { fotos: 3, medicoes: 2 },
    });
    expect(json.criadoEm).toMatch(/^2026-10-26T\d\d:30:00[+-]\d\d:\d\d$/);
    expect(Object.keys(json).slice(0, 7)).toEqual([
      'formato',
      'versao',
      'criadoEm',
      'esquemaDb',
      'app',
      'resumo',
      'importacaoAtual',
    ]);
    expect(Object.keys(json.fotos[0])).toEqual(
      expect.arrayContaining(['id', 'alvoId', 'tipo', 'base64', 'miniaturaBase64']),
    );
    expect(json.fotos[2].miniaturaBase64).toBeUndefined();
    expect(json.fotos[1].daPlaca).toBe(true);
    expect(texto.split('\n').filter((l) => l.includes('"base64":"'))).toHaveLength(3);
  });

  it.each([1, 2, 3, 7, 64, 1000, 65_536])(
    'lê igual em fatias de %i bytes (texto, acentos e escapes cortados no meio)',
    async (tamanhoFatia) => {
      const original = conteudo();
      const lido = await lerBackup(await backupDe(original), { tamanhoFatia });
      await comparar(original, lido.tudo);
    },
  );

  it('backup sem nenhuma foto nem medição (aparelho só com o PCM)', async () => {
    const t = { ...conteudo(), medicoes: [], notas: [], fotos: [] };
    const lido = await lerBackup(await backupDe(t));
    expect(lido.resumo.fotos).toBe(0);
    await comparar(t, lido.tudo);
  });

  it('aparelho vazio também gera um backup que restaura', async () => {
    const vazio = await lerTudo();
    const lido = await lerBackup(await backupDe(vazio));
    expect(lido.tudo).toEqual(vazio);
  });
});

describe('backup inválido', () => {
  async function erro(arquivo: Blob | string): Promise<string> {
    const blob = typeof arquivo === 'string' ? new Blob([arquivo]) : arquivo;
    try {
      await lerBackup(blob, { tamanhoFatia: 997 });
    } catch (e) {
      expect(e).toBeInstanceOf(BackupInvalido);
      return (e as Error).message;
    }
    throw new Error('aceitou um backup inválido');
  }

  it('não é um backup', async () => {
    expect(await erro('olá, isto não é json')).toBe(MENSAGEM.naoEBackup);
    expect(await erro('')).toBe(MENSAGEM.naoEBackup);
    expect(await erro('[1, 2, 3]')).toBe(MENSAGEM.naoEBackup);
    expect(await erro('{"nome": "planilha", "linhas": [1, 2]}')).toBe(MENSAGEM.naoEBackup);
    expect(await erro('{"formato": "outro-app", "versao": 1}')).toBe(MENSAGEM.naoEBackup);
    expect(await erro(new Blob([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xff, 0xfe])]))).toBe(
      MENSAGEM.naoEBackup,
    );
    const xls = new Blob([readFileSync(FIXTURE)]);
    expect(await erro(xls)).toBe(MENSAGEM.naoEBackup);
  });

  it('versão mais nova do formato ou do banco', async () => {
    const texto = await (await backupDe(conteudo())).text();
    expect(await erro(texto.replace('"versao":1', '"versao":2'))).toBe(MENSAGEM.versaoNova);
    expect(await erro(texto.replace(/"esquemaDb":\d+/, '"esquemaDb":99'))).toBe(
      MENSAGEM.versaoNova,
    );
  });

  it('arquivo cortado em qualquer ponto (download interrompido)', async () => {
    const texto = await (await backupDe(conteudo())).text();
    const pontos = [1, 30, 200, 2_000, texto.length / 2, texto.length - 40, texto.length - 3];
    for (const p of pontos) {
      const msg = await erro(texto.slice(0, Math.floor(p)));
      expect([MENSAGEM.incompleto, MENSAGEM.naoEBackup]).toContain(msg);
    }
    expect(await erro(texto.slice(0, texto.length - 3))).toBe(MENSAGEM.incompleto);
  });

  it('uma foto a menos que o resumo (linha perdida) é incompleto', async () => {
    const linhas = (await (await backupDe(conteudo())).text()).split('\n');
    const k = linhas.findIndex((l) => l.includes('"id":"foto-2"'));
    linhas.splice(k, 1);
    expect(await erro(linhas.join('\n'))).toBe(MENSAGEM.incompleto);
  });

  it('registro estragado', async () => {
    const texto = await (await backupDe(conteudo())).text();
    expect(await erro(texto.replace(/("id":"foto-2".*?"base64":")/, '$1!!!não é base64!!!'))).toBe(
      MENSAGEM.estragado('foto 2'),
    );
    // Tipo de item ou marca que este app não conhece = backup de versão mais nova.
    expect(await erro(texto.replace('"tipo":"tapete"', '"tipo":"foguete"'))).toBe(
      MENSAGEM.versaoNova,
    );
    expect(await erro(texto.replace('"lonas":"diverge"', '"lonas":"talvez"'))).toBe(
      MENSAGEM.versaoNova,
    );
    expect(await erro(texto.replace('"lonas":"diverge"', '"lonas":3'))).toBe(
      MENSAGEM.estragado('medição 1'),
    );
    expect(await erro(texto.replace('"tipo":"tapete"', '"tipo":7'))).toMatch(/estragado \(item/);
    expect(await erro(texto.replace('"importacaoAtual":"imp-1"', '"importacaoAtual":"x"'))).toBe(
      MENSAGEM.estragado('PCM atual'),
    );
    expect(await erro(texto.replace('"id":"foto-2"', '"id":"foto-1"'))).toBe(
      MENSAGEM.estragado('foto repetido'),
    );
    expect(await erro(texto.trimEnd() + ' {"mais": 1}')).toMatch(/registro estragado/);
  });
});

describe('restauração atômica', () => {
  it('se uma gravação falhar no meio, nada muda (entra tudo ou nada)', async () => {
    const antes = conteudo();
    await gravarRestauracao(antes);
    const outro = { ...conteudo(), medicoes: [], notas: [] };
    // foto sem id: o IndexedDB recusa no meio da transação
    outro.fotos = [...outro.fotos, { ...outro.fotos[0]!, id: undefined as unknown as string }];
    await expect(gravarRestauracao(outro)).rejects.toThrow();
    await comparar(antes, await lerTudo());
  });

  it('dados que mudaram depois da leitura (saiu da tela, outra janela): recusa e nada muda', async () => {
    const antes = conteudo();
    await gravarRestauracao(antes);
    const esperado = impressaoDe(await lerTudo());
    const novo = { ...conteudo(), medicoes: [], notas: [] };

    // Uma medida editada (relógio voltando: atualizadaEm MENOR que as outras, mesma contagem).
    await salvarMedicao({
      ...antes.medicoes[1]!,
      valores: { potencia: '777' },
      atualizadaEm: '2026-10-20T00:00:00.000Z',
    });
    let agora = await lerTudo();
    await expect(gravarRestauracao(novo, { esperado })).rejects.toBeInstanceOf(
      DadosMudaramDuranteRestauracao,
    );
    await comparar(agora, await lerTudo());

    // Uma foto nova.
    const esperado2 = impressaoDe(agora);
    await salvarFoto({ ...antes.fotos[0]!, id: 'foto-nova' });
    agora = await lerTudo();
    await expect(gravarRestauracao(novo, { esperado: esperado2 })).rejects.toBeInstanceOf(
      DadosMudaramDuranteRestauracao,
    );
    await comparar(agora, await lerTudo());

    // Sem mudança: restaura.
    await gravarRestauracao(novo, { esperado: impressaoDe(agora) });
    expect((await lerTudo()).medicoes).toEqual([]);
  });
});

describe('separarJson', () => {
  async function separar(texto: string, fatia: number) {
    const campos: [string, unknown][] = [];
    const elementos: [string, unknown, number][] = [];
    async function* fatias() {
      for (let i = 0; i < texto.length; i += fatia) yield texto.slice(i, i + fatia);
    }
    await separarJson(fatias(), {
      valor: (c, v) => campos.push([c, v]),
      elemento: (c, v, k) => elementos.push([c, v, k]),
    });
    return { campos, elementos };
  }

  it.each([1, 2, 5, 100])('JSON formatado de qualquer jeito (fatia %i)', async (fatia) => {
    const texto =
      '\uFEFF  {\n  "a" : 1 ,\n "b":"x\\"y\\\\",\n "lista" : [ ] , "c":{"d":[1,{"e":"]}"}]},\n' +
      ' "l2":[ {"k":"v,]"} , 2 ,"três", null,[1,[2]] ]\n}\n ';
    const r = await separar(texto, fatia);
    expect(r.campos).toEqual([
      ['a', 1],
      ['b', 'x"y\\'],
      ['c', { d: [1, { e: ']}' }] }],
    ]);
    expect(r.elementos).toEqual([
      ['l2', { k: 'v,]' }, 0],
      ['l2', 2, 1],
      ['l2', 'três', 2],
      ['l2', null, 3],
      ['l2', [1, [2]], 4],
    ]);
  });

  it.each(['{"a":1,}', '{"a":[1,]}', '{"a" 1}', '{"a":1}}', '{"a":[1 2]}', '{a:1}'])(
    'recusa JSON quebrado: %s',
    async (texto) => {
      await expect(separar(texto, 3)).rejects.toThrow();
    },
  );
});

describe('restaurar pelo app', () => {
  it('guarda antes uma cópia automática do estado atual e depois troca tudo', async () => {
    const { restaurarBackup } = await import('../../src/exportar/restaurar.ts');
    vi.stubGlobal('localStorage', memoria());
    const doOutro = conteudo();
    const arquivo = await backupDe(doOutro);

    // Este aparelho tem uma medição diferente, que tem que ficar na cópia.
    const daqui = { ...conteudo(), fotos: [], notas: [] };
    daqui.medicoes = [{ ...daqui.medicoes[0]!, valores: { largura: '999' } }];
    await gravarRestauracao(daqui);

    const etapas: string[] = [];
    const lido = await lerBackup(arquivo);
    const { copia } = await restaurarBackup(lido, (e) => etapas.push(e.etapa));
    expect(etapas[0]).toBe('copiando');
    expect(etapas.at(-1)).toBe('gravando');
    expect(copia?.nome).toMatch(
      /^levantamento-backup-antes-de-restaurar-\d{4}-\d\d-\d\d-\d{4}\.json$/,
    );

    await comparar(doOutro, await lerTudo());
    const [guardada, ...outras] = await lerCopias();
    expect(outras).toEqual([]);
    expect(guardada?.nome).toBe(copia?.nome);
    const daCopia = await lerBackup(guardada!.arquivo);
    expect(daCopia.tudo.medicoes).toEqual(daqui.medicoes);
    vi.unstubAllGlobals();
  });

  it('aparelho vazio: restaura sem cópia', async () => {
    const { restaurarBackup } = await import('../../src/exportar/restaurar.ts');
    vi.stubGlobal('localStorage', memoria());
    const { copia } = await restaurarBackup(await lerBackup(await backupDe(conteudo())));
    expect(copia).toBeNull();
    expect(await lerCopias()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('com medida ainda no diário, não restaura e não mexe em nada', async () => {
    const { restaurarBackup, MENSAGEM_RESTAURAR } = await import('../../src/exportar/restaurar.ts');
    const area = memoria();
    vi.stubGlobal('localStorage', area);
    const antes = conteudo();
    await gravarRestauracao(antes);
    area.setItem(`diario:medicao:${antes.itens[0]!.id}`, JSON.stringify(antes.medicoes[0]));
    const lido = await lerBackup(await backupDe({ ...conteudo(), medicoes: [] }));
    await expect(restaurarBackup(lido)).rejects.toThrow(MENSAGEM_RESTAURAR.pendente);
    await comparar(antes, await lerTudo());
    expect(await lerCopias()).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('o backup leva o que ainda está só no diário (banco cheio)', async () => {
    const { prepararBackup } = await import('../../src/exportar/preparar.ts');
    const area = memoria();
    vi.stubGlobal('localStorage', area);
    const t = conteudo();
    await gravarRestauracao(t);
    const maisNova = {
      ...t.medicoes[0]!,
      valores: { largura: '701' },
      atualizadaEm: '2026-10-26T18:00:00.000Z',
    };
    area.setItem(`diario:medicao:${maisNova.itemId}`, JSON.stringify(maisNova));
    const { arquivo } = await prepararBackup();
    expect(arquivo.name).toMatch(/^levantamento-backup-.*\.json$/);
    const lido = await lerBackup(arquivo);
    expect(lido.tudo.medicoes.find((m) => m.itemId === maisNova.itemId)).toEqual(maisNova);
    expect(lido.app).toBe('0.1.0');
    vi.unstubAllGlobals();
  });

  it('medida gravada enquanto a cópia é feita (saiu da tela): não restaura e a medida fica', async () => {
    const { restaurarBackup, ErroAoRestaurar } = await import('../../src/exportar/restaurar.ts');
    vi.stubGlobal('localStorage', memoria());
    const antes = conteudo();
    await gravarRestauracao(antes);
    const lido = await lerBackup(await backupDe({ ...conteudo(), medicoes: [] }));
    let gravou: Promise<void> | null = null;
    const nova = {
      ...antes.medicoes[0]!,
      valores: { largura: '777' },
      atualizadaEm: '2026-10-26T20:00:00.000Z',
    };
    await expect(
      restaurarBackup(lido, (e) => {
        if (e.etapa === 'copiando' && !gravou) gravou = salvarMedicao(nova);
      }),
    ).rejects.toBeInstanceOf(ErroAoRestaurar);
    await gravou;
    expect((await lerTudo()).medicoes.find((m) => m.itemId === nova.itemId)).toEqual(nova);
    expect(await lerCopias()).toEqual([]); // a cópia só entra junto com a restauração
    vi.unstubAllGlobals();
  });

  it('a cópia só é trocada se a restauração der certo; ficam as 2 últimas', async () => {
    const { restaurarBackup } = await import('../../src/exportar/restaurar.ts');
    vi.stubGlobal('localStorage', memoria());
    const real = conteudo();
    real.medicoes = [{ ...real.medicoes[0]!, valores: { largura: 'REAL' } }];
    await gravarRestauracao(real);
    const backup = async (largura: string) => {
      const t = conteudo();
      t.medicoes = [{ ...t.medicoes[0]!, valores: { largura } }];
      return lerBackup(await backupDe(t));
    };
    const larguraDa = async (c: { arquivo: Blob }) =>
      (await lerBackup(c.arquivo)).tudo.medicoes[0]!.valores.largura;

    await restaurarBackup(await backup('A')); // arquivo errado
    await restaurarBackup(await backup('B')); // tentou outro
    let copias = await lerCopias();
    expect(await Promise.all(copias.map(larguraDa))).toEqual(['A', 'REAL']); // a real continua

    // Restauração que falha (registro recusado pelo banco): nem os dados nem as cópias mudam.
    const estragado = await backup('C');
    estragado.tudo.fotos = [{ ...estragado.tudo.fotos[0]!, id: undefined as unknown as string }];
    await expect(restaurarBackup(estragado)).rejects.toThrow();
    expect((await lerTudo()).medicoes[0]!.valores.largura).toBe('B');
    copias = await lerCopias();
    expect(await Promise.all(copias.map(larguraDa))).toEqual(['A', 'REAL']);

    await restaurarBackup(await backup('D'));
    copias = await lerCopias();
    expect(await Promise.all(copias.map(larguraDa))).toEqual(['B', 'A']);
    vi.unstubAllGlobals();
  });
});
