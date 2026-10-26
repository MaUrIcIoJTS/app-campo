import { useEffect, useRef, useState } from 'preact/hooks';
import { IconeVoltar } from './Icones.tsx';
import { IndicadorSalvo } from './IndicadorSalvo.tsx';
import { voltarPara } from './rota.ts';

interface Props {
  /** Nome curto do app na barra (só na tela inicial) e o nome completo para leitores de tela. */
  titulo?: { curto: string; completo: string };
  voltar?: { href: string; rotulo: string };
  /** Onde se está (a TAG na ficha): aparece ao lado do voltar quando a página rola. */
  contexto?: string;
}

/** Barra fixa: voltar (ou nome do app) e "Salvo no aparelho" sempre à vista. */
export function Topo({ titulo, voltar, contexto }: Props) {
  const sentinela = useRef<HTMLDivElement>(null);
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const el = sentinela.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([e]) => setRolou(!e?.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <>
      {/* Some da tela assim que a página rola: a barra ganha tom. */}
      <div ref={sentinela} class="topo-sentinela" aria-hidden="true" />
      <header class="topo" data-rolou={rolou || undefined}>
        {voltar ? (
          <a
            class="topo-voltar"
            href={voltar.href}
            aria-label={voltar.rotulo}
            title={voltar.rotulo}
            onClick={(e) => {
              e.preventDefault();
              voltarPara(voltar.href);
            }}
          >
            <IconeVoltar />
          </a>
        ) : (
          <h1 class="topo-titulo" aria-label={titulo?.completo}>
            {titulo?.curto}
          </h1>
        )}
        {voltar && contexto && (
          <span class="topo-contexto" aria-hidden={!rolou}>
            {contexto}
          </span>
        )}
        <IndicadorSalvo />
      </header>
    </>
  );
}
