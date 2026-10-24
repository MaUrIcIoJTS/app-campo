import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { pedirArmazenamentoPersistente } from './armazenamento.ts';

export function App() {
  const {
    offlineReady: [offlinePronto],
    needRefresh: [temAtualizacao],
    updateServiceWorker,
  } = useRegisterSW();
  const [persistente, setPersistente] = useState<boolean | null>(null);

  useEffect(() => {
    void pedirArmazenamentoPersistente().then(setPersistente);
  }, []);

  const controlado = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  const offline = offlinePronto || controlado;

  return (
    <main class="tela">
      <header class="topo">
        <h1>Levantamento PCM</h1>
      </header>

      {temAtualizacao && (
        <div class="aviso" role="status">
          <span>Nova versão disponível.</span>
          <button type="button" class="botao" onClick={() => void updateServiceWorker(true)}>
            Atualizar
          </button>
        </div>
      )}

      <section class="cartao">
        <p>Olá! Este é o esqueleto do app.</p>
        <ul class="status">
          <li data-ok={offline}>
            {offline ? 'Pronto para usar offline' : 'Preparando uso offline…'}
          </li>
          <li data-ok={persistente === true}>
            {persistente === null
              ? 'Verificando armazenamento…'
              : persistente
                ? 'Dados protegidos no aparelho'
                : 'Armazenamento comum (instale o app para proteger)'}
          </li>
        </ul>
      </section>
    </main>
  );
}
