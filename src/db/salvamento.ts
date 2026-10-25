/**
 * Gravação automática: cada alteração é agendada e vai para o IndexedDB em até ~300 ms
 * (no máximo 1 s mesmo digitando sem parar). Ao esconder/fechar o app, grava na hora.
 * Falha de gravação NÃO descarta o dado: ele volta para a fila, o estado vira "erro" e a
 * fila tenta de novo sozinha (2 s, 5 s, 15 s, 15 s…).
 */

export type EstadoGravacao = 'salvo' | 'salvando' | 'erro';

export interface FilaDeGravacao {
  /** Agenda a gravação de `chave`; uma nova chamada com a mesma chave substitui a anterior. */
  agendar(chave: string, gravar: () => Promise<void>): void;
  /** Grava tudo que está pendente agora. Resolve mesmo se falhar — confira `estado()`. */
  descarregar(): Promise<void>;
  estado(): EstadoGravacao;
  pendentes(): number;
  /** Último erro de gravação (null depois de gravar com sucesso). */
  ultimoErro(): unknown;
  ouvir(fn: (estado: EstadoGravacao) => void): () => void;
}

interface Opcoes {
  atrasoMs?: number;
  maxEsperaMs?: number;
  retentativasMs?: readonly number[];
}

export function criarFilaDeGravacao({
  atrasoMs = 300,
  maxEsperaMs = 1000,
  retentativasMs = [2000, 5000, 15000],
}: Opcoes = {}): FilaDeGravacao {
  const pendentes = new Map<string, () => Promise<void>>();
  const ouvintes = new Set<(e: EstadoGravacao) => void>();
  let estado: EstadoGravacao = 'salvo';
  let erro: unknown = null;
  let falhasSeguidas = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let primeiraPendencia: number | null = null;
  let emAndamento: Promise<void> = Promise.resolve();

  const notificar = () => {
    for (const fn of ouvintes) fn(estado);
  };
  const mudar = (novo: EstadoGravacao) => {
    if (novo === estado) return;
    estado = novo;
    notificar();
  };

  async function gravarLote(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    primeiraPendencia = null;
    if (pendentes.size === 0) return;
    const lote = [...pendentes];
    pendentes.clear();
    // Promise.resolve().then: uma exceção SÍNCRONA em `gravar` vira rejeição só daquela chave.
    const resultados = await Promise.allSettled(
      lote.map(([, gravar]) => Promise.resolve().then(gravar)),
    );
    let falhou = false;
    resultados.forEach((r, k) => {
      if (r.status !== 'rejected') return;
      falhou = true;
      erro = r.reason;
      const [chave, gravar] = lote[k]!;
      // Não sobrescreve uma versão mais nova agendada enquanto gravava.
      if (!pendentes.has(chave)) pendentes.set(chave, gravar);
      console.error('Falha ao gravar', chave, r.reason);
    });
    if (falhou) {
      falhasSeguidas++;
      const espera = retentativasMs[Math.min(falhasSeguidas, retentativasMs.length) - 1] ?? 15000;
      clearTimeout(timer);
      timer = setTimeout(() => void descarregar(), espera);
      estado = 'erro';
      notificar(); // mesmo já em erro: a causa pode ter mudado
      return;
    }
    falhasSeguidas = 0;
    erro = null;
    if (pendentes.size === 0) mudar('salvo');
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
    ultimoErro: () => erro,
    ouvir(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
  };
}

/** Erro de cota: o celular está sem espaço para o navegador. */
export function semEspaco(erro: unknown): boolean {
  const nome = (erro as { name?: unknown } | null)?.name;
  return nome === 'QuotaExceededError' || (erro instanceof Error && /quota/i.test(erro.message));
}

/** Fila única do app. */
export const filaDeGravacao = criarFilaDeGravacao();

let operacoesCriticas = 0;

/** Marca uma operação (ex.: gravar importação) durante a qual o app NÃO pode recarregar. */
export async function semRecarregarDurante<T>(fn: () => Promise<T>): Promise<T> {
  operacoesCriticas++;
  try {
    return await fn();
  } finally {
    operacoesCriticas--;
  }
}

/** Alguma operação crítica (foto gravando, importação) ainda não terminou. */
export const emOperacaoCritica = () => operacoesCriticas > 0;

/** Descarrega a fila e diz se é seguro recarregar o app (nada pendente, nada em andamento). */
export async function prontoParaRecarregar(
  fila: FilaDeGravacao = filaDeGravacao,
): Promise<boolean> {
  await fila.descarregar();
  return operacoesCriticas === 0 && fila.pendentes() === 0 && fila.estado() === 'salvo';
}

/** Grava na hora quando o app vai para segundo plano ou é fechado. */
export function instalarDescargaAoSair(fila: FilaDeGravacao = filaDeGravacao): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void fila.descarregar();
  });
  window.addEventListener('pagehide', () => void fila.descarregar());
}
