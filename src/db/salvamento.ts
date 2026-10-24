/**
 * Gravação automática: cada alteração é agendada e vai para o IndexedDB em até ~300 ms
 * (no máximo 1 s mesmo digitando sem parar). Ao esconder/fechar o app, grava na hora.
 * Falha de gravação NÃO descarta o dado: ele volta para a fila e o estado vira "erro".
 */

export type EstadoGravacao = 'salvo' | 'salvando' | 'erro';

export interface FilaDeGravacao {
  /** Agenda a gravação de `chave`; uma nova chamada com a mesma chave substitui a anterior. */
  agendar(chave: string, gravar: () => Promise<void>): void;
  /** Grava tudo que está pendente agora. */
  descarregar(): Promise<void>;
  estado(): EstadoGravacao;
  pendentes(): number;
  ouvir(fn: (estado: EstadoGravacao) => void): () => void;
}

export function criarFilaDeGravacao({ atrasoMs = 300, maxEsperaMs = 1000 } = {}): FilaDeGravacao {
  const pendentes = new Map<string, () => Promise<void>>();
  const ouvintes = new Set<(e: EstadoGravacao) => void>();
  let estado: EstadoGravacao = 'salvo';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let primeiraPendencia: number | null = null;
  let emAndamento: Promise<void> = Promise.resolve();

  const mudar = (novo: EstadoGravacao) => {
    if (novo === estado) return;
    estado = novo;
    for (const fn of ouvintes) fn(novo);
  };

  async function gravarLote(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    primeiraPendencia = null;
    if (pendentes.size === 0) return;
    const lote = [...pendentes];
    pendentes.clear();
    const resultados = await Promise.allSettled(lote.map(([, gravar]) => gravar()));
    let falhou = false;
    resultados.forEach((r, k) => {
      if (r.status === 'rejected') {
        falhou = true;
        const [chave, gravar] = lote[k]!;
        // Não sobrescreve uma versão mais nova agendada enquanto gravava.
        if (!pendentes.has(chave)) pendentes.set(chave, gravar);
        console.error('Falha ao gravar', chave, r.reason);
      }
    });
    if (falhou) mudar('erro');
    else if (pendentes.size === 0) mudar('salvo');
  }

  function descarregar(): Promise<void> {
    // Encadeia para nunca rodar dois lotes ao mesmo tempo (ordem das gravações preservada).
    emAndamento = emAndamento.then(gravarLote, gravarLote);
    return emAndamento;
  }

  return {
    agendar(chave, gravar) {
      pendentes.set(chave, gravar);
      if (estado !== 'erro') mudar('salvando');
      const agora = Date.now();
      primeiraPendencia ??= agora;
      clearTimeout(timer);
      const espera = Math.max(0, Math.min(atrasoMs, primeiraPendencia + maxEsperaMs - agora));
      timer = setTimeout(() => void descarregar(), espera);
    },
    descarregar,
    estado: () => estado,
    pendentes: () => pendentes.size,
    ouvir(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
  };
}

/** Fila única do app. */
export const filaDeGravacao = criarFilaDeGravacao();

/** Grava na hora quando o app vai para segundo plano ou é fechado. */
export function instalarDescargaAoSair(fila: FilaDeGravacao = filaDeGravacao): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void fila.descarregar();
  });
  window.addEventListener('pagehide', () => void fila.descarregar());
}
