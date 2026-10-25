/**
 * Mantém a tela acesa durante operações longas (preparar backup, restaurar): se a tela apagar,
 * o Android pode congelar ou matar a aba no meio. Sem suporte (ou recusado), segue normal.
 */
export async function comTelaAcesa<T>(fn: () => Promise<T>): Promise<T> {
  let trava: { release(): Promise<void> } | null = null;
  try {
    trava = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    // bateria fraca, aba em segundo plano ou navegador sem suporte
  }
  try {
    return await fn();
  } finally {
    void trava?.release().catch(() => {});
  }
}
