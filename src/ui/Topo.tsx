import { IndicadorSalvo } from './IndicadorSalvo.tsx';

interface Props {
  /** Nome do app (só na tela inicial). Nas outras telas o título vai no conteúdo, inteiro. */
  titulo?: string;
  voltar?: { href: string; rotulo: string };
}

/** Barra fixa: voltar (ou nome do app) e "Salvo no aparelho" sempre à vista. */
export function Topo({ titulo, voltar }: Props) {
  return (
    <header class="topo">
      {voltar ? (
        <a class="topo-voltar" href={voltar.href}>
          ‹ {voltar.rotulo}
        </a>
      ) : (
        <h1 class="topo-titulo">{titulo}</h1>
      )}
      <IndicadorSalvo />
    </header>
  );
}
