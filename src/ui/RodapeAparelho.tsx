import { useEffect } from 'preact/hooks';
import { useDados } from './dados.tsx';
import { atualizarEspaco, useEstadoFotos } from './fotos.ts';
import { rotas } from './rota.ts';
import { NOME_TEMA, type Tema } from './tema.ts';

export interface StatusAparelho {
  offline: boolean;
  persistente: boolean | null;
}

/** Linha compacta no topo da lista, só quando algo NÃO está pronto para o campo. */
export function AlertaAparelho({ status }: { status: StatusAparelho }) {
  const problemas = [
    !status.offline && 'Ainda não está pronto para uso sem internet. Mantenha a internet ligada.',
    status.persistente === false && 'Instale o app na tela inicial para proteger os dados.',
  ].filter(Boolean);
  if (problemas.length === 0) return null;
  return (
    <div class="aviso aviso--bloco alerta-aparelho" role="status">
      {problemas.map((p) => (
        <p key={String(p)}>⚠ {p}</p>
      ))}
    </div>
  );
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
