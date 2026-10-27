import { useEffect } from 'preact/hooks';
import { useDados } from './dados.tsx';
import { atualizarEspaco, useEstadoFotos } from './fotos.ts';
import type { StatusAparelho } from './EstadoDoAparelho.tsx';
import { rotas } from './rota.ts';
import { NOME_TEMA, type Tema } from './tema.ts';
import { IconeArquivo, IconeAviso, IconeFeito, IconeSalvando, IconeTema } from './Icones.tsx';

/** Ícone da linha de estado: feito, aviso ou ainda verificando. */
function IconeEstado({ estado }: { estado: 'ok' | 'alerta' | 'aguardando' }) {
  if (estado === 'ok') return <IconeFeito />;
  if (estado === 'alerta') return <IconeAviso />;
  return <IconeSalvando />;
}

interface Props {
  status: StatusAparelho;
  tema: Tema;
  trocarTema: () => void;
}

/** Estado do aparelho e ações gerais, no fim da lista. */
export function RodapeAparelho({ status, tema, trocarTema }: Props) {
  const { dados } = useDados();
  const { espaco } = useEstadoFotos();
  useEffect(() => void atualizarEspaco(), []);
  const imp = dados?.importacao;
  const { offline, persistente } = status;
  return (
    <section class="cartao rodape" aria-label="Aparelho">
      <ul class="status">
        {/* O que não está pronto (sem internet, app não instalado) aparece no topo da lista;
            repetir aqui faria a mesma frase aparecer duas vezes na tela. */}
        {offline && (
          <li data-estado="ok">
            <IconeEstado estado="ok" />
            Pronto para usar offline
          </li>
        )}
        {persistente !== false && (
          <li data-estado={persistente ? 'ok' : 'aguardando'}>
            <IconeEstado estado={persistente ? 'ok' : 'aguardando'} />
            {persistente ? 'Dados protegidos no aparelho' : 'Verificando armazenamento…'}
          </li>
        )}
        {espaco && (
          <li data-estado={espaco.nivel === 'ok' ? 'ok' : 'alerta'}>
            <IconeEstado estado={espaco.nivel === 'ok' ? 'ok' : 'alerta'} />
            Espaço para ~{espaco.fotosQueCabem.toLocaleString('pt-BR')}{' '}
            {espaco.fotosQueCabem === 1 ? 'foto' : 'fotos'}
          </li>
        )}
      </ul>
      {imp && (
        <p class="suave">
          PCM: {imp.nomeArquivo} · importado em{' '}
          {new Date(imp.importadaEm).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </p>
      )}
      <div class="acoes">
        <a class="botao botao--secundario" href={rotas.importar}>
          <IconeArquivo />
          {imp ? 'Trocar o PCM' : 'Importar PCM'}
        </a>
        <button type="button" class="botao botao--secundario" onClick={trocarTema}>
          <IconeTema />
          Tema: {NOME_TEMA[tema]}
        </button>
      </div>
      <p class="suave">{__VERSAO__}</p>
    </section>
  );
}
