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

export type ImportacaoResumo = Omit<Importacao, 'arquivo'>;

export interface Dados {
  importacao: ImportacaoResumo | null;
  equipamentos: EquipamentoDb[];
  itensPorEquipamento: Map<string, ItemDb[]>;
  medicoes: Map<string, Medicao>;
  notas: Map<string, NotaEquipamento>;
  /** alvoId → quantidade de fotos (os blobs não são carregados aqui). */
  fotosPorAlvo: Map<string, number>;
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
  await tx.done;
}

/** Carrega tudo que as telas precisam (sem os blobs de fotos e do arquivo). */
export async function carregarDados(): Promise<Dados> {
  const db = await banco();
  const tx = db.transaction(
    ['importacoes', 'equipamentos', 'itens', 'medicoes', 'notas', 'meta'],
    'readonly',
  );
  const [atual, equipamentos, itens, medicoes, notas] = await Promise.all([
    tx.objectStore('meta').get(CHAVE_IMPORTACAO_ATUAL),
    tx.objectStore('equipamentos').getAll(),
    tx.objectStore('itens').getAll(),
    tx.objectStore('medicoes').getAll(),
    tx.objectStore('notas').getAll(),
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
  };
}

export async function salvarMedicao(medicao: Medicao): Promise<void> {
  await (await banco()).put('medicoes', medicao);
}

export async function salvarNota(nota: NotaEquipamento): Promise<void> {
  await (await banco()).put('notas', nota);
}

export async function salvarFoto(foto: Foto): Promise<void> {
  await (await banco()).put('fotos', foto);
}
