/**
 * Esquema do IndexedDB. REGRA: nunca edite uma migração já publicada — crie a próxima.
 * Toda migração nova precisa de teste em tests/unit/banco.test.ts com dados da versão anterior.
 */
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import type { EquipamentoPcm, ItemPcm } from '../dominio/tipos.ts';

export const NOME_BANCO = 'levantamento-pcm';

/** Arquivo do PCM como foi importado (guardado para exportar com a mesma estrutura). */
export interface Importacao {
  id: string;
  nomeArquivo: string;
  importadaEm: string;
  tamanho: number;
  abas: string[];
  arquivo: Blob;
}

export type EquipamentoDb = Omit<EquipamentoPcm, 'itens'> & {
  importacaoId: string;
  /** Posição na planilha (aba, depois linha) — ordem da lista. */
  ordem: number;
  /** Não existe mais no PCM importado por último, mas tem dados do usuário. */
  orfao?: boolean;
};

export type ItemDb = ItemPcm & {
  equipamentoId: string;
  ordem: number;
  orfao?: boolean;
};

export type Conferencia = 'confere' | 'diverge';

/** Medições de um item. Valores ficam como o técnico digitou ("38,1"). */
export interface Medicao {
  itemId: string;
  valores: Record<string, string>;
  conferencia: Record<string, Conferencia>;
  observacao: string;
  atualizadaEm: string;
}

export interface NotaEquipamento {
  equipamentoId: string;
  observacao: string;
  atualizadaEm: string;
}

export interface Foto {
  id: string;
  /** Id do item ou do equipamento. */
  alvoId: string;
  blob: Blob;
  criadaEm: string;
  largura: number;
  altura: number;
}

export interface Meta {
  chave: string;
  valor: unknown;
}

export interface EsquemaBanco extends DBSchema {
  importacoes: { key: string; value: Importacao };
  equipamentos: { key: string; value: EquipamentoDb; indexes: { porAba: string } };
  itens: { key: string; value: ItemDb; indexes: { porEquipamento: string } };
  medicoes: { key: string; value: Medicao };
  notas: { key: string; value: NotaEquipamento };
  fotos: { key: string; value: Foto; indexes: { porAlvo: string } };
  meta: { key: string; value: Meta };
}

/** Migrações enxergam o banco sem tipos: o esquema antigo pode ser diferente do atual. */
export type Migracao = (
  db: IDBPDatabase<unknown>,
  tx: IDBPTransaction<unknown, string[], 'versionchange'>,
) => void;

/** `MIGRACOES[n]` leva o banco da versão n para a n+1. */
export const MIGRACOES: readonly Migracao[] = [
  // 0 → 1: esquema inicial
  (db) => {
    db.createObjectStore('importacoes', { keyPath: 'id' });
    db.createObjectStore('equipamentos', { keyPath: 'id' }).createIndex('porAba', 'aba');
    db.createObjectStore('itens', { keyPath: 'id' }).createIndex('porEquipamento', 'equipamentoId');
    db.createObjectStore('medicoes', { keyPath: 'itemId' });
    db.createObjectStore('notas', { keyPath: 'equipamentoId' });
    db.createObjectStore('fotos', { keyPath: 'id' }).createIndex('porAlvo', 'alvoId');
    db.createObjectStore('meta', { keyPath: 'chave' });
  },
];

export const VERSAO_BANCO = MIGRACOES.length;
