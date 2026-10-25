import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { pedirArmazenamentoPersistente } from './armazenamento.ts';
import { prontoParaRecarregar } from './db/salvamento.ts';
import { ProvedorDados } from './ui/dados.tsx';
import type { StatusAparelho } from './ui/EstadoDoAparelho.tsx';
import { RodapeAparelho } from './ui/RodapeAparelho.tsx';
import { rotas, useRota, voltarPara } from './ui/rota.ts';
import { TelaEquipamento } from './ui/TelaEquipamento.tsx';
import { TelaExportar } from './ui/TelaExportar.tsx';
import { TelaImportar } from './ui/TelaImportar.tsx';
import { TelaRestaurar } from './ui/TelaRestaurar.tsx';
import { useRestaurando } from './exportar/restaurar.ts';
import { TelaLista, type Filtros } from './ui/TelaLista.tsx';
import { useTema } from './ui/tema.ts';

export function App() {
  const {
    offlineReady: [offlinePronto],
    needRefresh: [temAtualizacao],
    updateServiceWorker,
  } = useRegisterSW();
  const rota = useRota();
  // Restaurando: só a tela de restaurar (sair e medir agora seria apagado pela restauração).
  const restaurando = useRestaurando();
  const [tema, trocarTema] = useTema();
  const [filtros, setFiltros] = useState<Filtros>({ termo: '', aba: '' });
  // Aviso temporário de uma tela: só aparece nela (trocar de tela não leva o aviso junto).
  const [aviso, setAviso] = useState<{ texto: string; tela: string } | null>(null);
  const [avisoAtualizacao, setAvisoAtualizacao] = useState<string | null>(null);
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

  useEffect(() => {
    if (!avisoAtualizacao) return;
    const t = setTimeout(() => setAvisoAtualizacao(null), 5000);
    return () => clearTimeout(t);
  }, [avisoAtualizacao]);

  const status: StatusAparelho = {
    offline: offlinePronto || !!navigator.serviceWorker?.controller,
    persistente,
  };

  async function atualizar() {
    // Recarregar com medida na fila (ou durante uma importação) perderia dado.
    if (await prontoParaRecarregar()) await updateServiceWorker(true);
    // A resposta aparece na própria barra, perto do dedo que tocou "Atualizar".
    else setAvisoAtualizacao('Ainda salvando medidas. Tente daqui a pouco.');
  }

  const mostrarAtualizacao = temAtualizacao && !adiouAtualizacao;

  return (
    <ProvedorDados>
      {rota.tela === 'importar' ? (
        <TelaImportar
          onImportado={(mensagem) => {
            setAviso({ texto: mensagem, tela: 'lista' });
            voltarPara(rotas.lista);
          }}
        />
      ) : rota.tela === 'exportar' ? (
        <TelaExportar />
      ) : restaurando || rota.tela === 'restaurar' ? (
        <TelaRestaurar />
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

      {aviso?.tela === rota.tela && !restaurando && (
        // No topo, logo abaixo da barra: nunca cobre os botões do fim da tela.
        <div class="toast" role="status">
          {aviso.texto}
        </div>
      )}

      {mostrarAtualizacao && (
        <div class="barra-atualizacao" role="status">
          <span>{avisoAtualizacao ?? 'Nova versão do app.'}</span>
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
