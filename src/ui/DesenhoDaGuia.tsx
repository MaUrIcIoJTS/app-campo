import { useState } from 'preact/hooks';
import type { IdGuia } from '../dominio/guias.ts';
import type { IdDesenho } from '../dominio/templates/registro.ts';
import { DESENHOS } from './desenhos/index.ts';

/** O desenho "onde medir" que abre cada guia (os demais ficam nos cartões dos itens). */
export function desenhoDaGuia(
  guia: IdGuia,
  temTambor: boolean,
): { id: IdDesenho; titulo: string } | null {
  switch (guia) {
    case 'correia':
      return { id: 'vista-superior', titulo: 'Vista de cima' };
    case 'tambores':
      return temTambor
        ? { id: 'tambor', titulo: 'Onde medir o tambor' }
        : { id: 'mancal', titulo: 'Onde medir o mancal' };
    case 'roletes':
      return { id: 'rolete', titulo: 'Como ler o código do rolete' };
    case 'acionamento':
      return { id: 'acionamento', titulo: 'O que medir no acionamento' };
    default:
      return null;
  }
}

// Quem ocultou o desenho de uma guia não quer vê-lo de novo em toda ficha (só neste aparelho).
const CHAVE = 'desenhos-ocultos';

function ocultos(): string[] {
  try {
    const r: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function lembrar(id: IdDesenho, aberto: boolean): void {
  const lista = ocultos().filter((x) => x !== id);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(aberto ? lista : [...lista, id]));
  } catch {
    // sem localStorage: só não lembra
  }
}

/** Desenho no alto da guia, aberto (como no protótipo de campo); "Ocultar" recolhe. */
export function DesenhoDaGuia({ id, titulo }: { id: IdDesenho; titulo: string }) {
  const [aberto, setAberto] = useState(() => !ocultos().includes(id));
  const { Svg, legenda } = DESENHOS[id];
  return (
    <details
      class="cartao desenho-guia"
      open={aberto}
      onToggle={(e) => {
        const agora = e.currentTarget.open;
        if (agora === aberto) return;
        setAberto(agora);
        lembrar(id, agora);
      }}
    >
      <summary>
        <span class="desenho-guia-titulo">{titulo}</span>
        <span class="desenho-guia-acao">{aberto ? 'Ocultar' : 'Ver desenho'}</span>
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
