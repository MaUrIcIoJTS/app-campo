/**
 * Diário síncrono das últimas alterações, em localStorage.
 *
 * O IndexedDB grava de forma assíncrona (e a fila espera até 300 ms). Se o Android matar o
 * app nessa janela, o valor se perderia. Por isso cada alteração é anotada AQUI na hora
 * (setItem é síncrono) e apagada depois que o IndexedDB confirma. Ao abrir o app, o que
 * sobrou no diário é reaplicado.
 *
 * O diário é rede de segurança, não armazenamento: se o navegador bloquear o localStorage,
 * tudo segue funcionando só com a fila.
 */

const PREFIXO = 'diario:';

export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
  key(indice: number): string | null;
  readonly length: number;
}

function local(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function anotar(chave: string, registro: unknown, area = local()): void {
  try {
    area?.setItem(PREFIXO + chave, JSON.stringify(registro));
  } catch {
    // cota cheia ou bloqueado: a fila do IndexedDB continua valendo
  }
}

export function riscar(chave: string, area = local()): void {
  try {
    area?.removeItem(PREFIXO + chave);
  } catch {
    // idem
  }
}

/**
 * Risca só se o diário ainda guarda exatamente este registro. Se o técnico digitou de novo
 * enquanto o IndexedDB gravava a versão anterior, a anotação mais nova fica.
 */
export function riscarSe(chave: string, registro: unknown, area = local()): void {
  try {
    if (area?.getItem(PREFIXO + chave) === JSON.stringify(registro))
      area.removeItem(PREFIXO + chave);
  } catch {
    // idem
  }
}

/** Chave do diário a partir da chave do localStorage (evento `storage` de outra janela). */
export function chaveDoDiario(chaveArmazenamento: string | null): string | null {
  return chaveArmazenamento?.startsWith(PREFIXO) ? chaveArmazenamento.slice(PREFIXO.length) : null;
}

/** Tudo que ficou no diário (gravações que talvez não chegaram ao IndexedDB). */
export function pendentesNoDiario(area = local()): Array<[chave: string, registro: unknown]> {
  if (!area) return [];
  const saida: Array<[string, unknown]> = [];
  try {
    for (let i = 0; i < area.length; i++) {
      const k = area.key(i);
      if (!k?.startsWith(PREFIXO)) continue;
      try {
        saida.push([k.slice(PREFIXO.length), JSON.parse(area.getItem(k) ?? 'null')]);
      } catch {
        // entrada corrompida: ignora (não trava a abertura do app)
      }
    }
  } catch {
    return [];
  }
  return saida;
}
