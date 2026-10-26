import { useEffect, useState } from 'preact/hooks';
import { filaDeGravacao, semEspaco, type EstadoGravacao } from '../db/salvamento.ts';
import { guiaDoItem, type IdGuia } from '../dominio/guias.ts';
import { useDados } from './dados.tsx';
import { useResumoFotos, type Destino } from './fotos.ts';
import { irPara, lerRota, rotas, substituirPor } from './rota.ts';
import { IconeErro, IconeFeito, IconeSalvando } from './Icones.tsx';

/**
 * Leva até o aviso da foto que não salvou: abre a ficha do equipamento na guia do item (ou
 * em Fotos, se a foto é do equipamento), se o aviso não estiver na tela.
 */
function irAoAvisoDeFoto({ equipamentoId }: Destino, guia: IdGuia | undefined) {
  const mostrar = () => {
    const aviso = document.querySelector<HTMLElement>('.fotos-aviso');
    aviso?.scrollIntoView({ block: 'center' });
    return !!aviso;
  };
  if (mostrar()) return;
  const destino = rotas.equipamento(equipamentoId, guia);
  const rota = lerRota(location.hash);
  // Na mesma ficha, só troca de guia (sem empilhar histórico); de fora, abre a ficha.
  if (rota.tela === 'equipamento' && rota.id === equipamentoId) substituirPor(destino);
  else irPara(destino);
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
        <IconeErro />
        Dados não abriram
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
        <IconeErro />
        {semEspaco(filaDeGravacao.ultimoErro()) ? 'Celular sem espaço' : 'Não salvou. Tentar'}
      </button>
    );
  }
  if (falha) {
    // O aviso pode estar num cartão fora da tela: o topo não pode dizer "✓ Salvo".
    return (
      <button
        type="button"
        class="salvo salvo--erro"
        onClick={() => {
          const { destino } = falha[1];
          const item = dados?.itensPorEquipamento
            .get(destino.equipamentoId)
            ?.find((i) => i.id === destino.alvoId);
          irAoAvisoDeFoto(
            destino,
            destino.alvoId === destino.equipamentoId ? 'fotos' : item && guiaDoItem(item),
          );
        }}
      >
        <IconeErro />
        Foto não salva
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
      {salvando ? <IconeSalvando /> : <IconeFeito />}
      {fotos > 0 ? 'Salvando foto…' : salvando ? 'Salvando…' : 'Salvo no aparelho'}
    </span>
  );
}
