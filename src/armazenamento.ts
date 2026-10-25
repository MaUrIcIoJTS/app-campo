import { situacaoEspaco, type SituacaoEspaco } from './dominio/fotos.ts';

/** Quanto ainda cabe, pela estimativa do navegador (null se ele não informar). */
export async function estimarEspaco(): Promise<SituacaoEspaco | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    return situacaoEspaco(await navigator.storage.estimate());
  } catch {
    return null;
  }
}

/**
 * Pede ao navegador para não apagar os dados do app quando faltar espaço.
 * Chrome concede automaticamente para PWA instalado/usado com frequência;
 * Safari ignora, mas não custa pedir.
 */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
