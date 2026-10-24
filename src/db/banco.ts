import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { MIGRACOES, NOME_BANCO, type EsquemaBanco, type Migracao } from './esquema.ts';

export type Banco = IDBPDatabase<EsquemaBanco>;

/**
 * Abre (e migra, se preciso) o banco. `aoPerderConexao` é chamado se outra aba precisar
 * migrar (fechamos para liberar) ou se o navegador encerrar a conexão.
 */
export async function abrirBanco(
  nome: string = NOME_BANCO,
  migracoes: readonly Migracao[] = MIGRACOES,
  aoPerderConexao?: () => void,
): Promise<Banco> {
  // blocking/terminated só disparam depois que a abertura terminou (conexao já existe).
  const conexao: Banco = await openDB<EsquemaBanco>(nome, migracoes.length, {
    upgrade(db, versaoAntiga, _versaoNova, tx) {
      const dbSemTipo = db as unknown as IDBPDatabase<unknown>;
      const txSemTipo = tx as unknown as IDBPTransaction<unknown, string[], 'versionchange'>;
      for (let v = versaoAntiga; v < migracoes.length; v++) migracoes[v]?.(dbSemTipo, txSemTipo);
    },
    blocking() {
      conexao.close();
      aoPerderConexao?.();
    },
    terminated() {
      aoPerderConexao?.();
    },
  });
  return conexao;
}

let aberto: Promise<Banco> | null = null;

/** Conexão única do app. Se cair ou falhar ao abrir, a próxima chamada tenta de novo. */
export function banco(): Promise<Banco> {
  if (!aberto) {
    const esta: Promise<Banco> = abrirBanco(NOME_BANCO, MIGRACOES, () => {
      if (aberto === esta) aberto = null;
    });
    esta.catch(() => {
      if (aberto === esta) aberto = null;
    });
    aberto = esta;
  }
  return aberto;
}

/** Fecha a conexão única (restauração de backup e testes). */
export async function fecharBanco(): Promise<void> {
  const atual = aberto;
  aberto = null;
  if (atual) (await atual.catch(() => null))?.close();
}
