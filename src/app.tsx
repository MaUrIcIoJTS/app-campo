import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { pedirArmazenamentoPersistente } from './armazenamento.ts';
import { prontoParaRecarregar } from './db/salvamento.ts';
import { ProvedorDados } from './ui/dados.tsx';
import { RodapeAparelho, type StatusAparelho } from './ui/RodapeAparelho.tsx';
import { rotas, useRota, voltarPara } from './ui/rota.ts';
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
  const [adiouAtualizacao, setAdiouAtualizacao] = useState(false);

  useEffect(() => {
    void pedirArmazenamentoPersistente().then(setPersistente);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  const status: StatusAparelho = {
    offline: offlinePronto || !!navigator.serviceWorker?.controller,
    persistente,
  };

  async function atualizar() {
    // Recarregar com medida na fila (ou durante uma importação) perderia dado.
    if (await prontoParaRecarregar()) await updateServiceWorker(true);
    else setAviso('Ainda há medidas sendo salvas. Atualize daqui a pouco.');
  }

  const mostrarAtualizacao = temAtualizacao && !adiouAtualizacao;

  return (
    <ProvedorDados>
      {rota.tela === 'importar' ? (
        <TelaImportar
          onImportado={(mensagem) => {
            setAviso(mensagem);
            voltarPara(rotas.lista);
          }}
        />
      ) : rota.tela === 'equipamento' ? (
        <TelaEquipamento id={rota.id} abaFiltrada={filtros.aba} />
      ) : (
        <TelaLista
          filtros={filtros}
          onFiltros={setFiltros}
          status={status}
          rodape={<RodapeAparelho status={status} tema={tema} trocarTema={trocarTema} />}
        />
      )}

      {aviso && (
        <div class={mostrarAtualizacao ? 'toast toast--acima' : 'toast'} role="status">
          {aviso}
        </div>
      )}

      {mostrarAtualizacao && (
        <div class="barra-atualizacao" role="status">
          <span>Nova versão do app.</span>
          <button
            type="button"
            class="botao botao--secundario"
            onClick={() => setAdiouAtualizacao(true)}
          >
            Agora não
          </button>
          <button type="button" class="botao" onClick={() => void atualizar()}>
            Atualizar
          </button>
        </div>
      )}
    </ProvedorDados>
  );
}
