import type { ItemDb, Medicao } from '../db/esquema.ts';
import {
  avisosDoItem,
  comConferencia,
  comObservacao,
  comValor,
  itemDiverge,
  valorPcm,
} from '../dominio/medicao.ts';
import { progressoItem } from '../dominio/progresso.ts';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import { CampoMedicao } from './CampoMedicao.tsx';
import { DesenhosDoItem } from './DesenhosDoItem.tsx';
import { irAoProximoCampo } from './foco.ts';
import { FotosDoAlvo } from './FotosDoAlvo.tsx';

export const idDoCartao = (itemId: string) => `item-${itemId}`;

/** Selo do item (no cartão e no índice): diverge › aviso › feito › "3/7". */
export function estadoDoItem(item: ItemDb, medicao: Medicao | undefined) {
  const p = progressoItem(item, medicao);
  const contagem = `${p.preenchidos}/${p.total}`;
  if (itemDiverge(item, medicao)) return { texto: '✗ Diverge', classe: 'item-estado--diverge' };
  if (avisosDoItem(item, medicao).length > 0)
    return { texto: `⚠ ${contagem}`, classe: 'item-estado--aviso' };
  if (p.preenchidos === p.total) return { texto: `${contagem} feito`, classe: 'item-estado--ok' };
  return { texto: contagem, classe: '' };
}

/** Leva o item para o topo da tela, logo abaixo da barra fixa (sem abrir o teclado). */
export function irParaItem(itemId: string) {
  const cartao = document.getElementById(idDoCartao(itemId));
  if (!cartao) return;
  const barra = document.querySelector('.topo')?.getBoundingClientRect().height ?? 60;
  window.scrollTo(0, cartao.getBoundingClientRect().top + window.scrollY - barra - 8);
  cartao.querySelector<HTMLElement>('.item-nome')?.focus({ preventScroll: true });
}

interface Props {
  item: ItemDb;
  medicao: Medicao | undefined;
  /** Próximo item da ficha (null no último). */
  proximo: ItemDb | null;
  onMedicao: (mudar: (atual: Medicao | undefined) => Medicao) => void;
}

export function CartaoItem({ item, medicao, proximo, onMedicao }: Props) {
  const template = TEMPLATES[item.tipo];
  const estado = estadoDoItem(item, medicao);
  const avisos = avisosDoItem(item, medicao);
  // Se um campo já mostra a especificação inteira como valor do PCM, não repete aqui.
  const especNoCampo = template.campos.some((c) => valorPcm(c, item) === item.especificacao);
  const idObs = `obs-${item.id}`;

  return (
    <li
      id={idDoCartao(item.id)}
      class={estado.classe === 'item-estado--diverge' ? 'item cartao item--diverge' : 'item cartao'}
    >
      {/* Fica preso no topo enquanto o cartão está na tela: sempre se sabe qual item é. */}
      <div class="item-topo">
        <h2 class="item-nome" tabIndex={-1}>
          {item.nome}
        </h2>
        <span class={`item-estado ${estado.classe}`}>{estado.texto}</span>
      </div>
      <p class="item-tipo">{template.nome}</p>
      {item.especificacao && !especNoCampo && (
        <p class="item-pcm">
          <span class="rotulo-pcm">PCM</span> {item.especificacao}
        </p>
      )}
      {item.quantidade && <p class="item-qtd">Qtd.: {item.quantidade}</p>}
      {item.origem === 'deduzido' && (
        <span class="selo">Não está no PCM — deduzido dos mancais</span>
      )}
      {item.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
      <DesenhosDoItem ids={template.desenhos} />
      {/* Motor e redutor: a placa é a primeira coisa a registrar (modelo, série, redução). */}
      {template.fotoPlaca && (
        <FotosDoAlvo alvoId={item.id} nome={item.nome} rotulo="Foto da placa" placa />
      )}

      <div class="campos">
        {template.campos.map((c) => (
          <CampoMedicao
            key={c.id}
            campo={c}
            item={item}
            valor={medicao?.valores[c.id]}
            conferencia={medicao?.conferencia[c.id]}
            onValor={(v) => onMedicao((m) => comValor(m, item.id, c.id, v))}
            onConferencia={(marca) => onMedicao((m) => comConferencia(m, item.id, c.id, marca))}
          />
        ))}
      </div>

      {avisos.map((a) => (
        <p key={a} class="aviso aviso--bloco" role="status">
          ⚠ {a}
        </p>
      ))}

      {/* Antes da observação: longe do "Próximo item" (toque mais comum). */}
      <FotosDoAlvo
        alvoId={item.id}
        nome={item.nome}
        rotulo="Tirar foto"
        comPlaca={!template.fotoPlaca}
      />

      <label class="campo-med-rotulo obs-rotulo" for={idObs}>
        Observação do item
      </label>
      <textarea
        id={idObs}
        class="campo campo-texto"
        rows={2}
        enterkeyhint="next"
        value={medicao?.observacao ?? ''}
        onInput={(e) => {
          const texto = e.currentTarget.value;
          onMedicao((m) => comObservacao(m, item.id, texto));
        }}
        onKeyDown={irAoProximoCampo}
        data-campo-ficha
      />

      {proximo && (
        <button
          type="button"
          class="botao botao--secundario botao--largo item-proximo"
          onClick={() => irParaItem(proximo.id)}
        >
          Próximo item ↓
        </button>
      )}
    </li>
  );
}
