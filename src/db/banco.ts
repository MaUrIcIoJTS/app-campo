import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { MIGRACOES, NOME_BANCO, type EsquemaBanco, type Migracao } from './esquema.ts';

export type Banco = IDBPDatabase<EsquemaBanco>;

/** Abre (e migra, se preciso) o banco. Parâmetros existem para os testes simularem versões. */
export function abrirBanco(
  nome: string = NOME_BANCO,
  migracoes: readonly Migracao[] = MIGRACOES,
): Promise<Banco> {
  return openDB<EsquemaBanco>(nome, migracoes.length, {
    upgrade(db, versaoAntiga, _versaoNova, tx) {
      const dbSemTipo = db as unknown as IDBPDatabase<unknown>;
      const txSemTipo = tx as unknown as IDBPTransaction<unknown, string[], 'versionchange'>;
      for (let v = versaoAntiga; v < migracoes.length; v++) migracoes[v]?.(dbSemTipo, txSemTipo);
    },
    blocking() {
      // Outra aba abriu uma versão mais nova do app: libera o banco para ela migrar.
      void aberto?.then((db) => db.close());
      aberto = null;
    },
  });
}

let aberto: Promise<Banco> | null = null;

/** Conexão única do app. */
export function banco(): Promise<Banco> {
  aberto ??= abrirBanco();
  return aberto;
}

/** Fecha a conexão única (restauração de backup e testes). */
export async function fecharBanco(): Promise<void> {
  const atual = aberto;
  aberto = null;
  if (atual) (await atual).close();
}
