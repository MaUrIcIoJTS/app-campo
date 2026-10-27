import { useEffect, useState } from 'preact/hooks';
import type { Medicao } from '../db/esquema.ts';
import { chavePerimetro, estadoDaCota } from '../dominio/croqui.ts';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';
import { idDoCampo } from './CampoCroqui.tsx';
import { DesenhoNoAlto } from './DesenhoDaGuia.tsx';

const LEGENDA =
  'Toque numa letra para ir ao campo.\nCheia: medida. Vazia: falta. Cinza: sem acesso ou não tem.';

type ModuloCroqui = typeof import('./desenhos/croqui.tsx');

// Os desenhos dos croquis vêm num chunk à parte (fica no precache: abre offline).
let carregado: ModuloCroqui | null = null;

function useDesenhosDoCroqui(): ModuloCroqui | 'erro' | null {
  const [modulo, setModulo] = useState(carregado);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (carregado) return;
    let vivo = true;
    import('./desenhos/croqui.tsx')
      .then((m) => {
        carregado = m;
        if (vivo) setModulo(m);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);
  return erro ? 'erro' : modulo;
}

/** O croqui no alto da guia "Exterior": letras com o estado de cada cota; tocar leva ao campo. */
export function CroquiDaGuia({ item, medicao }: { item: ItemPcm; medicao: Medicao | undefined }) {
  const desenhos = useDesenhosDoCroqui();
  const campos = TEMPLATES[item.tipo].campos.filter((c) => c.letra);
  const estados = Object.fromEntries(
    campos.map((c) => [
      c.letra!,
      estadoDaCota(
        medicao?.valores[c.id],
        c.perimetro ? medicao?.valores[chavePerimetro(c.id)] : undefined,
        medicao?.conferencia[c.id],
      ),
    ]),
  );
  const irAoCampo = (letra: string) => {
    const campo = campos.find((c) => c.letra === letra);
    const el = campo && document.getElementById(idDoCampo(item.id, campo.id));
    if (!el) return;
    el.closest('.campo-med')?.scrollIntoView({ block: 'center' });
    if (el instanceof HTMLInputElement && !el.disabled) el.focus({ preventScroll: true });
  };
  return (
    <DesenhoNoAlto chave="croqui" titulo="Croqui: onde medir">
      {desenhos === 'erro' ? (
        // Os campos com as letras continuam abaixo: dá para medir sem o desenho.
        <p class="aviso">Não foi possível abrir o desenho. As cotas estão abaixo.</p>
      ) : desenhos ? (
        <desenhos.Croqui tipo={item.tipo} estados={estados} onToque={irAoCampo} />
      ) : (
        <div class="croqui-carregando" aria-hidden="true" />
      )}
      <figcaption>{LEGENDA}</figcaption>
    </DesenhoNoAlto>
  );
}
