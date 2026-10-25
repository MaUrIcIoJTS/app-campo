/** Leituras e escritas do app no IndexedDB. Cada operação é uma transação (tudo ou nada). */
import { banco, type Banco } from './banco.ts';
import type {
  EquipamentoDb,
  Foto,
  Importacao,
  ItemDb,
  Medicao,
  NotaEquipamento,
} from './esquema.ts';
import type { Pcm } from '../dominio/tipos.ts';
import {
  planejarReimportacao,
  registrosDoPcm,
  type PlanoReimportacao,
} from '../dominio/reimportacao.ts';

const CHAVE_IMPORTACAO_ATUAL = 'importacaoAtual';
const CHAVE_ULTIMO_BACKUP = 'ultimoBackup';
const PREFIXO_COPIA = 'copiaAntesDeRestaurar:';
const COPIAS_MANTIDAS = 2;

export type ImportacaoResumo = Omit<Importacao, 'arquivo'>;

export interface Dados {
  importacao: ImportacaoResumo | null;
  equipamentos: EquipamentoDb[];
  itensPorEquipamento: Map<string, ItemDb[]>;
  medicoes: Map<string, Medicao>;
  notas: Map<string, NotaEquipamento>;
  /** alvoId → quantidade de fotos (os blobs não são carregados aqui). */
  fotosPorAlvo: Map<string, number>;
  /** Último backup baixado/compartilhado, para "Último backup: há 2 h". */
  ultimoBackup: UltimoBackup | null;
}

/** alvoId → nº de fotos, percorrendo só as chaves do índice (não carrega os blobs). */
async function contarFotos(db: Banco): Promise<Map<string, number>> {
  const contagem = new Map<string, number>();
  const indice = db.transaction('fotos').store.index('porAlvo');
  for (let c = await indice.openKeyCursor(); c; c = await c.continue()) {
    contagem.set(c.key, (contagem.get(c.key) ?? 0) + 1);
  }
  return contagem;
}

/** Ids de item/equipamento que têm qualquer dado do usuário. */
async function idsComDados(db: Banco): Promise<Set<string>> {
  const [medicoes, notas, fotos] = await Promise.all([
    db.getAllKeys('medicoes'),
    db.getAllKeys('notas'),
    contarFotos(db),
  ]);
  return new Set([...medicoes, ...notas, ...fotos.keys()]);
}

export interface PreviaImportacao {
  plano: PlanoReimportacao;
  /** Quantos registros do usuário já existem (para avisar antes de importar). */
  existentes: { medicoes: number; fotos: number; notas: number };
  /** Ids com dado do usuário quando a prévia foi feita — conferidos de novo ao gravar. */
  idsComDados: string[];
}

/** O usuário (ou a fila) gravou algo entre a prévia e a confirmação: refazer a prévia. */
export class DadosMudaramDuranteImportacao extends Error {
  constructor() {
    super('Os dados do aparelho mudaram durante a importação.');
    this.name = 'DadosMudaramDuranteImportacao';
  }
}

/** Retratos de segurança guardados em `meta` (os mais antigos são descartados). */
const RETRATOS_MANTIDOS = 5;

/**
 * Roda `corpo` na transação e só resolve depois do commit. Qualquer erro aborta a transação
 * inteira — inclusive um `put` recusado na hora (chave inválida, valor que não clona), que o
 * IndexedDB NÃO aborta sozinho: sem isto, o que veio antes do erro (ex.: `clear()`) seria gravado.
 */
async function tudoOuNada(
  tx: { done: Promise<void>; abort(): void },
  corpo: () => Promise<void>,
): Promise<void> {
  tx.done.catch(() => {}); // se abortar, o erro sai pelo throw abaixo
  try {
    await corpo();
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      // já terminou ou já foi abortada
    }
    throw e;
  }
}

/** Calcula o que a importação vai fazer, sem gravar nada. */
export async function previaImportacao(pcm: Pcm, importacaoId: string): Promise<PreviaImportacao> {
  const db = await banco();
  const [equipamentos, itens, comDados, medicoes, fotos, notas] = await Promise.all([
    db.getAll('equipamentos'),
    db.getAll('itens'),
    idsComDados(db),
    db.count('medicoes'),
    db.count('fotos'),
    db.count('notas'),
  ]);
  const plano = planejarReimportacao(
    { equipamentos, itens },
    registrosDoPcm(pcm, importacaoId),
    comDados,
    importacaoId,
  );
  return { plano, existentes: { medicoes, fotos, notas }, idsComDados: [...comDados].sort() };
}

/**
 * Grava a importação numa transação só: arquivo original, equipamentos/itens novos,
 * e move medições/notas/fotos conforme o plano. Se algo falhar, nada muda.
 * Antes de mexer, confere que os dados do usuário são os mesmos que a prévia viu e guarda
 * um retrato (medições, notas e vínculos das fotos) em `meta` como rede de segurança.
 */
export async function gravarImportacao(
  importacao: Importacao,
  previa: PreviaImportacao,
): Promise<void> {
  const { plano } = previa;
  const db = await banco();
  const tx = db.transaction(
    ['importacoes', 'equipamentos', 'itens', 'medicoes', 'notas', 'fotos', 'meta'],
    'readwrite',
  );
  await tudoOuNada(tx, async () => {
    const medicoes = tx.objectStore('medicoes');
    const notas = tx.objectStore('notas');
    const fotos = tx.objectStore('fotos');
    const meta = tx.objectStore('meta');

    // 0) Confere e fotografa o estado atual, dentro da mesma transação.
    const todasMedicoes = await medicoes.getAll();
    const todasNotas = await notas.getAll();
    const vinculosFotos: { id: string; alvoId: string }[] = [];
    for (let c = await fotos.index('porAlvo').openKeyCursor(); c; c = await c.continue()) {
      vinculosFotos.push({ id: c.primaryKey, alvoId: c.key });
    }
    const agora = new Set([
      ...todasMedicoes.map((m) => m.itemId),
      ...todasNotas.map((n) => n.equipamentoId),
      ...vinculosFotos.map((f) => f.alvoId),
    ]);
    const naPrevia = new Set(previa.idsComDados);
    if (agora.size !== naPrevia.size || [...agora].some((id) => !naPrevia.has(id))) {
      tx.done.catch(() => {}); // a rejeição do abort é esperada
      tx.abort();
      throw new DadosMudaramDuranteImportacao();
    }
    await meta.put({
      chave: `retrato:${importacao.id}`,
      valor: {
        criadoEm: importacao.importadaEm,
        medicoes: todasMedicoes,
        notas: todasNotas,
        fotos: vinculosFotos,
      },
    });
    const retratos = (await meta.getAllKeys()).filter((k) => k.startsWith('retrato:')).sort();
    for (const k of retratos.slice(0, -RETRATOS_MANTIDOS)) await meta.delete(k);

    // 1) Lê tudo que vai mudar de id ANTES de escrever (os remapeamentos podem se encadear).
    const origem = await Promise.all(
      plano.remapear.map(async ([de, para]) => ({
        para,
        medicao: await medicoes.get(de),
        nota: await notas.get(de),
        fotos: await fotos.index('porAlvo').getAll(de),
        de,
      })),
    );
    // 2) Apaga as origens…
    for (const o of origem) {
      if (o.medicao) await medicoes.delete(o.de);
      if (o.nota) await notas.delete(o.de);
    }
    // 3) …e grava nos destinos.
    for (const o of origem) {
      if (o.medicao) await medicoes.put({ ...o.medicao, itemId: o.para });
      if (o.nota) await notas.put({ ...o.nota, equipamentoId: o.para });
      for (const f of o.fotos) await fotos.put({ ...f, alvoId: o.para });
    }

    await tx.objectStore('equipamentos').clear();
    await tx.objectStore('itens').clear();
    for (const e of plano.equipamentos) await tx.objectStore('equipamentos').put(e);
    for (const i of plano.itens) await tx.objectStore('itens').put(i);
    await tx.objectStore('importacoes').put(importacao);
    await meta.put({ chave: CHAVE_IMPORTACAO_ATUAL, valor: importacao.id });
  });
}

/** Carrega tudo que as telas precisam (sem os blobs de fotos e do arquivo). */
export async function carregarDados(): Promise<Dados> {
  const db = await banco();
  const tx = db.transaction(
    ['importacoes', 'equipamentos', 'itens', 'medicoes', 'notas', 'meta'],
    'readonly',
  );
  const [atual, equipamentos, itens, medicoes, notas, ultimoBackup] = await Promise.all([
    tx.objectStore('meta').get(CHAVE_IMPORTACAO_ATUAL),
    tx.objectStore('equipamentos').getAll(),
    tx.objectStore('itens').getAll(),
    tx.objectStore('medicoes').getAll(),
    tx.objectStore('notas').getAll(),
    tx.objectStore('meta').get(CHAVE_ULTIMO_BACKUP),
  ]);
  const imp =
    typeof atual?.valor === 'string'
      ? await tx.objectStore('importacoes').get(atual.valor)
      : undefined;
  await tx.done;
  const fotos = await contarFotos(db);

  equipamentos.sort((a, b) => a.ordem - b.ordem);
  const itensPorEquipamento = new Map<string, ItemDb[]>();
  for (const i of itens.sort((a, b) => a.ordem - b.ordem)) {
    const lista = itensPorEquipamento.get(i.equipamentoId) ?? [];
    lista.push(i);
    itensPorEquipamento.set(i.equipamentoId, lista);
  }
  let importacao: ImportacaoResumo | null = null;
  if (imp) {
    const { arquivo: _arquivo, ...resto } = imp;
    importacao = resto;
  }
  return {
    importacao,
    equipamentos,
    itensPorEquipamento,
    medicoes: new Map(medicoes.map((m) => [m.itemId, m])),
    notas: new Map(notas.map((n) => [n.equipamentoId, n])),
    fotosPorAlvo: fotos,
    ultimoBackup: lerUltimo(ultimoBackup?.valor),
  };
}

export async function salvarMedicao(medicao: Medicao): Promise<void> {
  await (await banco()).put('medicoes', medicao);
}

export async function salvarNota(nota: NotaEquipamento): Promise<void> {
  await (await banco()).put('notas', nota);
}

/**
 * Grava uma foto e só resolve depois que o banco confirmar. Foto não passa pelo diário (é
 * única e grande): `durability: 'strict'` pede ao navegador para gravar no disco antes.
 */
export async function salvarFoto(foto: Foto): Promise<void> {
  const tx = (await banco()).transaction('fotos', 'readwrite', { durability: 'strict' });
  tx.done.catch(() => {}); // se abortar (banco cheio), o erro vem pelo await abaixo
  await tx.store.put(foto);
  await tx.done;
}

export async function apagarFoto(id: string): Promise<void> {
  await (await banco()).delete('fotos', id);
}

/** Fotos (com os blobs) dos alvos pedidos — só as do equipamento aberto. */
export async function fotosDosAlvos(alvoIds: readonly string[]): Promise<Foto[]> {
  const tx = (await banco()).transaction('fotos');
  const indice = tx.store.index('porAlvo');
  const listas = await Promise.all(alvoIds.map((id) => indice.getAll(id)));
  await tx.done;
  return listas.flat();
}

/** Tudo o que o usuário tem no aparelho: o que o backup leva e a restauração grava. */
export interface TudoDoBanco {
  importacaoAtual: string | null;
  importacoes: Importacao[];
  equipamentos: EquipamentoDb[];
  itens: ItemDb[];
  medicoes: Medicao[];
  notas: NotaEquipamento[];
  /** Os blobs vêm do banco "apontando" para o disco: não ocupam a memória até serem lidos. */
  fotos: Foto[];
}

const STORES_DO_USUARIO = [
  'importacoes',
  'equipamentos',
  'itens',
  'medicoes',
  'notas',
  'fotos',
] as const;

/** Lê tudo numa transação só (retrato coerente, mesmo com o técnico mexendo no meio). */
export async function lerTudo(): Promise<TudoDoBanco> {
  const tx = (await banco()).transaction([...STORES_DO_USUARIO, 'meta'], 'readonly');
  const [atual, importacoes, equipamentos, itens, medicoes, notas, fotos] = await Promise.all([
    tx.objectStore('meta').get(CHAVE_IMPORTACAO_ATUAL),
    tx.objectStore('importacoes').getAll(),
    tx.objectStore('equipamentos').getAll(),
    tx.objectStore('itens').getAll(),
    tx.objectStore('medicoes').getAll(),
    tx.objectStore('notas').getAll(),
    tx.objectStore('fotos').getAll(),
  ]);
  await tx.done;
  return {
    importacaoAtual: typeof atual?.valor === 'string' ? atual.valor : null,
    importacoes,
    equipamentos: equipamentos.sort((a, b) => a.ordem - b.ordem),
    itens: itens.sort((a, b) => a.ordem - b.ordem),
    medicoes,
    notas,
    fotos,
  };
}

/** Arquivo original do PCM atual (para exportar a planilha com a mesma estrutura). */
export async function arquivoDaImportacao(id: string): Promise<Importacao | undefined> {
  return (await banco()).get('importacoes', id);
}

export interface ContagemDoAparelho {
  equipamentos: number;
  medicoes: number;
  notas: number;
  fotos: number;
  importacoes: number;
  /** Medida, observação ou foto mais recente (ISO), para comparar com a data do backup. */
  ultimaAlteracao: string | null;
}

export async function contarDoAparelho(): Promise<ContagemDoAparelho> {
  const tx = (await banco()).transaction(
    ['equipamentos', 'medicoes', 'notas', 'fotos', 'importacoes'],
    'readonly',
  );
  // getAll das fotos traz só as referências dos blobs (não carrega as imagens).
  const [equipamentos, medicoes, notas, fotos, importacoes] = await Promise.all([
    tx.objectStore('equipamentos').count(),
    tx.objectStore('medicoes').getAll(),
    tx.objectStore('notas').getAll(),
    tx.objectStore('fotos').getAll(),
    tx.objectStore('importacoes').count(),
  ]);
  await tx.done;
  let ultimaAlteracao: string | null = null;
  for (const d of [
    ...medicoes.map((m) => m.atualizadaEm),
    ...notas.map((n) => n.atualizadaEm),
    ...fotos.map((f) => f.criadaEm),
  ])
    if (!ultimaAlteracao || d > ultimaAlteracao) ultimaAlteracao = d;
  return {
    equipamentos,
    medicoes: medicoes.length,
    notas: notas.length,
    fotos: fotos.length,
    importacoes,
    ultimaAlteracao,
  };
}

/** Os dados do aparelho mudaram entre a leitura (cópia) e a gravação da restauração. */
export class DadosMudaramDuranteRestauracao extends Error {
  constructor() {
    super('Os dados do aparelho mudaram durante a restauração.');
    this.name = 'DadosMudaramDuranteRestauracao';
  }
}

/**
 * "Impressão digital" do que o usuário tem: muda com qualquer medição/nota editada (o
 * `atualizadaEm` de um registro sempre sobe ao editar), foto tirada/apagada ou importação.
 */
function impressao(
  medicoes: readonly Medicao[],
  notas: readonly NotaEquipamento[],
  fotoIds: readonly string[],
  importacaoIds: readonly string[],
): string {
  return JSON.stringify([
    medicoes.map((m) => `${m.itemId}@${m.atualizadaEm}`).sort(),
    notas.map((n) => `${n.equipamentoId}@${n.atualizadaEm}`).sort(),
    [...fotoIds].sort(),
    [...importacaoIds].sort(),
  ]);
}

export const impressaoDe = (t: TudoDoBanco) =>
  impressao(
    t.medicoes,
    t.notas,
    t.fotos.map((f) => f.id),
    t.importacoes.map((i) => i.id),
  );

/** Backup automático do aparelho, feito logo antes de uma restauração (ficam os 2 últimos). */
export interface CopiaAntesDeRestaurar {
  nome: string;
  criadaEm: string;
  arquivo: Blob;
}

interface OpcoesRestauracao {
  /** `impressaoDe` do que foi lido para a cópia: se o banco mudou desde então, nada é gravado. */
  esperado?: string;
  /** Cópia do estado atual: entra na MESMA transação (se a restauração falhar, não troca). */
  copia?: CopiaAntesDeRestaurar | null;
}

/**
 * Restauração: troca TUDO do usuário pelo conteúdo do backup numa transação só — se qualquer
 * gravação falhar (sem espaço, registro estragado) ou os dados tiverem mudado desde a cópia,
 * nada muda (nem as cópias). `meta` fica (retratos, cópias, último backup); só a importação
 * atual passa a ser a do backup.
 */
export async function gravarRestauracao(
  tudo: TudoDoBanco,
  { esperado, copia }: OpcoesRestauracao = {},
): Promise<void> {
  const tx = (await banco()).transaction([...STORES_DO_USUARIO, 'meta'], 'readwrite', {
    durability: 'strict',
  });
  // Cada pedido já nasce com tratamento: se a transação abortar no meio, os pedidos feitos
  // antes do erro rejeitam com AbortError (esperado) sem virar "erro não tratado".
  const pedidos: Promise<unknown>[] = [];
  const pedir = (p: Promise<unknown>) => {
    p.catch(() => {});
    pedidos.push(p);
  };
  await tudoOuNada(tx, async () => {
    if (esperado !== undefined) {
      const [medicoes, notas, fotoIds, importacaoIds] = await Promise.all([
        tx.objectStore('medicoes').getAll(),
        tx.objectStore('notas').getAll(),
        tx.objectStore('fotos').getAllKeys(),
        tx.objectStore('importacoes').getAllKeys(),
      ]);
      if (impressao(medicoes, notas, fotoIds, importacaoIds) !== esperado)
        throw new DadosMudaramDuranteRestauracao();
    }
    const meta = tx.objectStore('meta');
    if (copia) {
      const chave = PREFIXO_COPIA + copia.criadaEm;
      pedir(meta.put({ chave, valor: copia }));
      const copias = (await meta.getAllKeys()).filter((k) => k.startsWith(PREFIXO_COPIA));
      const antigas = [...new Set([...copias, chave])].sort().slice(0, -COPIAS_MANTIDAS);
      for (const k of antigas) pedir(meta.delete(k));
    }
    for (const s of STORES_DO_USUARIO) pedir(tx.objectStore(s).clear());
    for (const r of tudo.importacoes) pedir(tx.objectStore('importacoes').put(r));
    for (const r of tudo.equipamentos) pedir(tx.objectStore('equipamentos').put(r));
    for (const r of tudo.itens) pedir(tx.objectStore('itens').put(r));
    for (const r of tudo.medicoes) pedir(tx.objectStore('medicoes').put(r));
    for (const r of tudo.notas) pedir(tx.objectStore('notas').put(r));
    for (const r of tudo.fotos) pedir(tx.objectStore('fotos').put(r));
    pedir(
      tudo.importacaoAtual === null
        ? meta.delete(CHAVE_IMPORTACAO_ATUAL)
        : meta.put({ chave: CHAVE_IMPORTACAO_ATUAL, valor: tudo.importacaoAtual }),
    );
    await Promise.all(pedidos);
  });
}

/** Cópias automáticas guardadas, da mais nova para a mais velha. */
export async function lerCopias(): Promise<(CopiaAntesDeRestaurar & { chave: string })[]> {
  const db = await banco();
  const chaves = (await db.getAllKeys('meta'))
    .filter((k) => k.startsWith(PREFIXO_COPIA))
    .sort()
    .reverse();
  const registros = await Promise.all(chaves.map((k) => db.get('meta', k)));
  return registros.flatMap((r) => {
    const v = r?.valor as Partial<CopiaAntesDeRestaurar> | undefined;
    return r &&
      v?.arquivo instanceof Blob &&
      typeof v.nome === 'string' &&
      typeof v.criadaEm === 'string'
      ? [{ ...(v as CopiaAntesDeRestaurar), chave: r.chave }]
      : [];
  });
}

export async function apagarCopia(chave: string): Promise<void> {
  if (chave.startsWith(PREFIXO_COPIA)) await (await banco()).delete('meta', chave);
}

/** Último backup baixado/compartilhado neste aparelho e quantas fotos ele levava. */
export interface UltimoBackup {
  em: string;
  fotos: number;
}

function lerUltimo(valor: unknown): UltimoBackup | null {
  const v = valor as Partial<UltimoBackup> | null | undefined;
  return typeof v?.em === 'string' && typeof v.fotos === 'number'
    ? { em: v.em, fotos: v.fotos }
    : null;
}

export async function marcarUltimoBackup(ultimo: UltimoBackup): Promise<void> {
  await (await banco()).put('meta', { chave: CHAVE_ULTIMO_BACKUP, valor: ultimo });
}
