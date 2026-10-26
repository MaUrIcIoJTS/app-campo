import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { IdGuia } from '../dominio/guias.ts';
import { IconeConfere, IconeDiverge } from './Icones.tsx';

export interface GuiaNaBarra {
  id: IdGuia;
  rotulo: string;
  /** Tudo feito (✓) ou algum campo marcado ✗ na guia. */
  estado: 'feito' | 'diverge' | null;
  /** Número ao lado do nome (fotos). */
  contagem?: number;
}

export const idDaGuia = (id: IdGuia) => `guia-${id}`;
export const ID_PAINEL = 'painel-guia';

interface Props {
  guias: readonly GuiaNaBarra[];
  atual: IdGuia;
  onEscolher: (id: IdGuia) => void;
}

/**
 * Barra das guias da ficha (Correia, Tambores, Roletes…). Fica presa logo abaixo da barra do
 * topo; se não couber, rola de lado só ela (a página nunca). A guia aberta fica sempre à vista.
 */
export function Guias({ guias, atual, onEscolher }: Props) {
  const barra = useRef<HTMLDivElement>(null);
  const sentinela = useRef<HTMLDivElement>(null);
  const [presa, setPresa] = useState(false);

  // Presa sob o topo, ganha o tom da barra de cima: as duas viram uma barra só.
  useEffect(() => {
    const el = sentinela.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const topo = Math.round(document.querySelector('.topo')?.getBoundingClientRect().height ?? 64);
    const obs = new IntersectionObserver(
      ([e]) => setPresa(!!e && !e.isIntersecting && e.boundingClientRect.top <= topo),
      // 2 px além do topo: parada exatamente na borda (o caso comum) conta como presa.
      { rootMargin: `-${topo + 2}px 0px 0px 0px` },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    const nav = barra.current;
    const chip = nav?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!nav || !chip) return;
    const folga = 24; // mostra um pedaço da vizinha: dá para ver que a barra rola
    const esquerda = chip.offsetLeft - folga;
    const direita = chip.offsetLeft + chip.offsetWidth + folga - nav.clientWidth;
    if (nav.scrollLeft > esquerda) nav.scrollTo({ left: esquerda });
    else if (nav.scrollLeft < direita) nav.scrollTo({ left: direita });
  }, [atual]);

  return (
    <>
      <div ref={sentinela} class="guias-sentinela" aria-hidden="true" />
      <div
        ref={barra}
        class="guias"
        role="tablist"
        aria-label="Partes do equipamento"
        data-presa={presa || undefined}
      >
        {guias.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            id={idDaGuia(g.id)}
            class="guia"
            aria-selected={g.id === atual}
            aria-controls={ID_PAINEL}
            onClick={() => onEscolher(g.id)}
          >
            {g.rotulo}
            {/* Espaço no nome para leitor de tela ("Fotos 3", "Correia diverge"); o flex o ignora. */}
            {(g.contagem || g.estado) && ' '}
            {g.contagem ? <span class="guia-contagem">{g.contagem}</span> : null}
            {g.estado === 'diverge' && (
              <span class="guia-estado guia-estado--diverge">
                <IconeDiverge />
                <span class="oculto">diverge</span>
              </span>
            )}
            {g.estado === 'feito' && (
              <span class="guia-estado guia-estado--feito">
                <IconeConfere />
                <span class="oculto">feito</span>
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
