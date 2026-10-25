import { useEffect, useState } from 'preact/hooks';
import { filaDeGravacao, semEspaco, type EstadoGravacao } from '../db/salvamento.ts';
import { useDados } from './dados.tsx';
import { useResumoFotos } from './fotos.ts';
import { irPara, rotas } from './rota.ts';

/** Leva até o aviso da foto que não salvou (abre a ficha do equipamento, se preciso). */
function irAoAvisoDeFoto(equipamentoId: string) {
  const mostrar = () => {
    const aviso = document.querySelector<HTMLElement>('.fotos-aviso');
    aviso?.scrollIntoView({ block: 'center' });
    return !!aviso;
  };
  if (mostrar()) return;
  irPara(rotas.equipamento(equipamentoId));
  setTimeout(mostrar, 400); // depois que a ficha abrir e voltar onde estava
}

/**
 * "Salvo no aparelho" sempre visível. Só mostra ✓ depois que o banco abriu.
 * Em erro, vira botão para tentar gravar de novo (a fila também tenta sozinha).
 */
export function IndicadorSalvo() {
  const { dados, erro: erroAoAbrir } = useDados();
  const [estado, setEstado] = useState<EstadoGravacao>(filaDeGravacao.estado());
  useEffect(() => filaDeGravacao.ouvir(setEstado), []);
  const { gravando: fotos, falha } = useResumoFotos();

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
  if (falha) {
    // O aviso pode estar num cartão fora da tela: o topo não pode dizer "✓ Salvo".
    return (
      <button
        type="button"
        class="salvo salvo--erro"
        onClick={() => irAoAvisoDeFoto(falha[1].destino.equipamentoId)}
      >
        ⚠ Foto não salva
      </button>
    );
  }
  if (!dados) {
    return <span class="salvo salvo--salvando">Abrindo…</span>;
  }
  // Foto gravando: não é hora de fechar o app (ela ainda não está no banco).
  const salvando = estado === 'salvando' || fotos > 0;
  return (
    <span
      class={`salvo salvo--${salvando ? 'salvando' : 'salvo'}`}
      role="status"
      aria-live="polite"
    >
      {fotos > 0 ? 'Salvando foto…' : salvando ? 'Salvando…' : '✓ Salvo no aparelho'}
    </span>
  );
}
