import { IndicadorSalvo } from './IndicadorSalvo.tsx';
import { voltarPara } from './rota.ts';

interface Props {
  /** Nome curto do app na barra (só na tela inicial) e o nome completo para leitores de tela. */
  titulo?: { curto: string; completo: string };
  voltar?: { href: string; rotulo: string };
}

/** Barra fixa: voltar (ou nome do app) e "Salvo no aparelho" sempre à vista. */
export function Topo({ titulo, voltar }: Props) {
  return (
    <header class="topo">
      {voltar ? (
        <a
          class="topo-voltar"
          href={voltar.href}
          onClick={(e) => {
            e.preventDefault();
            voltarPara(voltar.href);
          }}
        >
          ‹ {voltar.rotulo}
        </a>
      ) : (
        <h1 class="topo-titulo" aria-label={titulo?.completo}>
          {titulo?.curto}
        </h1>
      )}
      <IndicadorSalvo />
    </header>
  );
}
