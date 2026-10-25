import { useEffect } from 'preact/hooks';
import { useDados } from './dados.tsx';
import { atualizarEspaco, useEstadoFotos } from './fotos.ts';
import type { StatusAparelho } from './EstadoDoAparelho.tsx';
import { rotas } from './rota.ts';
import { NOME_TEMA, type Tema } from './tema.ts';

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
        <li data-estado={offline ? 'ok' : 'alerta'}>
          {offline ? 'Pronto para usar offline' : 'Preparando uso offline…'}
        </li>
        <li data-estado={persistente === null ? 'aguardando' : persistente ? 'ok' : 'alerta'}>
          {persistente === null
            ? 'Verificando armazenamento…'
            : persistente
              ? 'Dados protegidos no aparelho'
              : 'Instale o app na tela inicial para proteger os dados'}
        </li>
        {espaco && (
          <li data-estado={espaco.nivel === 'ok' ? 'ok' : 'alerta'}>
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
          {imp ? 'Trocar o PCM' : 'Importar PCM'}
        </a>
        <button type="button" class="botao botao--secundario" onClick={trocarTema}>
          Tema: {NOME_TEMA[tema]}
        </button>
      </div>
    </section>
  );
}
