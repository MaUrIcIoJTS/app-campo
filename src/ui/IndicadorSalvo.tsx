import { useEffect, useState } from 'preact/hooks';
import { filaDeGravacao, semEspaco, type EstadoGravacao } from '../db/salvamento.ts';
import { useDados } from './dados.tsx';

/**
 * "Salvo no aparelho" sempre visível. Só mostra ✓ depois que o banco abriu.
 * Em erro, vira botão para tentar gravar de novo (a fila também tenta sozinha).
 */
export function IndicadorSalvo() {
  const { dados, erro: erroAoAbrir } = useDados();
  const [estado, setEstado] = useState<EstadoGravacao>(filaDeGravacao.estado());
  useEffect(() => filaDeGravacao.ouvir(setEstado), []);

  if (erroAoAbrir) {
    return (
      <span class="salvo salvo--erro" role="alert">
        ⚠ Dados não abriram
      </span>
    );
  }
  if (estado === 'erro') {
    return (
      <button
        type="button"
        class="salvo salvo--erro"
        onClick={() => void filaDeGravacao.descarregar()}
      >
        {semEspaco(filaDeGravacao.ultimoErro()) ? '⚠ Celular sem espaço' : '⚠ Não salvou. Tentar'}
      </button>
    );
  }
  if (!dados) {
    return <span class="salvo salvo--salvando">Abrindo…</span>;
  }
  return (
    <span class={`salvo salvo--${estado}`} role="status" aria-live="polite">
      {estado === 'salvando' ? 'Salvando…' : '✓ Salvo no aparelho'}
    </span>
  );
}
