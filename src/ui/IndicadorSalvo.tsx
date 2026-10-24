import { useEffect, useState } from 'preact/hooks';
import { filaDeGravacao, type EstadoGravacao } from '../db/salvamento.ts';

/** "Salvo no aparelho" sempre visível. Em erro, vira botão para tentar gravar de novo. */
export function IndicadorSalvo() {
  const [estado, setEstado] = useState<EstadoGravacao>(filaDeGravacao.estado());
  useEffect(() => filaDeGravacao.ouvir(setEstado), []);

  if (estado === 'erro') {
    return (
      <button
        type="button"
        class="salvo salvo--erro"
        onClick={() => void filaDeGravacao.descarregar()}
      >
        ⚠ Não salvou. Tocar p/ tentar
      </button>
    );
  }
  return (
    <span class={`salvo salvo--${estado}`} role="status" aria-live="polite">
      {estado === 'salvando' ? 'Salvando…' : '✓ Salvo no aparelho'}
    </span>
  );
}
