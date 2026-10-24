import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { NOME_TEMA, type Tema } from './tema.ts';

interface Props {
  offline: boolean;
  persistente: boolean | null;
  tema: Tema;
  trocarTema: () => void;
}

/** Estado do aparelho e ações gerais, no fim da lista. */
export function RodapeAparelho({ offline, persistente, tema, trocarTema }: Props) {
  const { dados } = useDados();
  const imp = dados?.importacao;
  return (
    <section class="cartao rodape" aria-label="Aparelho">
      <ul class="status">
        <li data-ok={offline}>
          {offline ? 'Pronto para usar offline' : 'Preparando uso offline…'}
        </li>
        <li data-ok={persistente === true}>
          {persistente === null
            ? 'Verificando armazenamento…'
            : persistente
              ? 'Dados protegidos no aparelho'
              : 'Instale o app na tela inicial para proteger os dados'}
        </li>
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
          {imp ? 'Importar outro PCM' : 'Importar PCM'}
        </a>
        <button type="button" class="botao botao--secundario" onClick={trocarTema}>
          Tema: {NOME_TEMA[tema]}
        </button>
      </div>
    </section>
  );
}
