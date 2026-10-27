import type { Medicao } from '../db/esquema.ts';
import { chavePerimetro, estadoDaCota } from '../dominio/croqui.ts';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';
import { idDoCampo } from './CampoCroqui.tsx';
import { DesenhoNoAlto } from './DesenhoDaGuia.tsx';
import { Croqui, LEGENDA_DO_CROQUI } from './desenhos/croqui.tsx';

/** O croqui no alto da guia "Exterior": letras com o estado de cada cota; tocar leva ao campo. */
export function CroquiDaGuia({ item, medicao }: { item: ItemPcm; medicao: Medicao | undefined }) {
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
      <Croqui tipo={item.tipo} estados={estados} onToque={irAoCampo} />
      <figcaption>{LEGENDA_DO_CROQUI}</figcaption>
    </DesenhoNoAlto>
  );
}
