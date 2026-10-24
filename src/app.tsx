import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { pedirArmazenamentoPersistente } from './armazenamento.ts';
import { filaDeGravacao } from './db/salvamento.ts';
import { ProvedorDados } from './ui/dados.tsx';
import { RodapeAparelho } from './ui/RodapeAparelho.tsx';
import { irPara, rotas, useRota } from './ui/rota.ts';
import { TelaEquipamento } from './ui/TelaEquipamento.tsx';
import { TelaImportar } from './ui/TelaImportar.tsx';
import { TelaLista, type Filtros } from './ui/TelaLista.tsx';
import { useTema } from './ui/tema.ts';

export function App() {
  const {
    offlineReady: [offlinePronto],
    needRefresh: [temAtualizacao],
    updateServiceWorker,
  } = useRegisterSW();
  const rota = useRota();
  const [tema, trocarTema] = useTema();
  const [filtros, setFiltros] = useState<Filtros>({ termo: '', aba: '' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [persistente, setPersistente] = useState<boolean | null>(null);

  useEffect(() => {
    void pedirArmazenamentoPersistente().then(setPersistente);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const offline = offlinePronto || !!navigator.serviceWorker?.controller;

  async function atualizar() {
    await filaDeGravacao.descarregar(); // nada pendente se perde no recarregamento
    await updateServiceWorker(true);
  }

  return (
    <ProvedorDados>
      {temAtualizacao && (
        <div class="aviso aviso--topo" role="status">
          <span>Nova versão do app.</span>
          <button type="button" class="botao" onClick={() => void atualizar()}>
            Atualizar
          </button>
        </div>
      )}

      {rota.tela === 'importar' ? (
        <TelaImportar
          onImportado={(mensagem) => {
            setAviso(mensagem);
            irPara(rotas.lista);
          }}
        />
      ) : rota.tela === 'equipamento' ? (
        <TelaEquipamento id={rota.id} />
      ) : (
        <TelaLista
          filtros={filtros}
          onFiltros={setFiltros}
          rodape={
            <RodapeAparelho
              offline={offline}
              persistente={persistente}
              tema={tema}
              trocarTema={trocarTema}
            />
          }
        />
      )}

      {aviso && (
        <div class="toast" role="status">
          {aviso}
        </div>
      )}
    </ProvedorDados>
  );
}
