import { useState } from 'preact/hooks';
import type { IdDesenho } from '../dominio/templates/registro.ts';
import { DESENHOS } from './desenhos/index.ts';
import { IconeExpandir, IconeRegua } from './Icones.tsx';

/** Desenhos "onde medir" do item: um botão por desenho, cada um abre e fecha sozinho. */
export function DesenhosDoItem({ ids }: { ids: readonly IdDesenho[] }) {
  return (
    <>
      {ids.map((id) => (
        <DesenhoRecolhivel key={id} id={id} />
      ))}
    </>
  );
}

/** Fechado por padrão (a ficha já é longa); o SVG só é montado quando aberto. */
function DesenhoRecolhivel({ id }: { id: IdDesenho }) {
  const [aberto, setAberto] = useState(false);
  const { nome, Svg, legenda } = DESENHOS[id];
  return (
    <details class="desenhos" onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary>
        <IconeRegua />
        <span>{aberto ? 'Fechar desenho' : `Desenho: ${nome}`}</span>
        <IconeExpandir />
      </summary>
      {aberto && (
        <figure class="desenho">
          <Svg />
          <figcaption>{legenda}</figcaption>
        </figure>
      )}
    </details>
  );
}
