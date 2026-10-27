/** Não procura de novo antes disto (voltar ao app várias vezes seguidas, internet oscilando). */
const INTERVALO_MS = 60_000;

/**
 * O navegador só procura versão nova do app quando ele é aberto do zero. No Android, o app
 * instalado volta do segundo plano sem isso, e a barra "Nova versão do app." não aparecia
 * (campo, 27/10). Procura também ao voltar para o app e quando a internet volta. É o mesmo
 * pedido do `sw.js` que o navegador faz ao abrir; sem internet, nada acontece.
 */
export function procurarAtualizacaoAoVoltar(
  registro: Pick<ServiceWorkerRegistration, 'update'>,
): () => void {
  let ultima = Date.now(); // o navegador acabou de procurar, ao abrir
  const procurar = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (Date.now() - ultima < INTERVALO_MS) return;
    ultima = Date.now();
    registro.update().catch(() => {}); // sinal ruim: tenta de novo na próxima volta
  };
  document.addEventListener('visibilitychange', procurar);
  window.addEventListener('online', procurar);
  return () => {
    document.removeEventListener('visibilitychange', procurar);
    window.removeEventListener('online', procurar);
  };
}
