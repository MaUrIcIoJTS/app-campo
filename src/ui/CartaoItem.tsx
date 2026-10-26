import { Fragment } from 'preact';
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
import { TEMPLATES, type IdDesenho } from '../dominio/templates/registro.ts';
import { CampoMedicao } from './CampoMedicao.tsx';
import { DesenhosDoItem } from './DesenhosDoItem.tsx';
import { irAoProximoCampo } from './foco.ts';
import { FotosDoAlvo } from './FotosDoAlvo.tsx';
import { IconeAviso, IconeConfere, IconeDiverge, IconeSetaBaixo } from './Icones.tsx';

export const idDoCartao = (itemId: string) => `item-${itemId}`;

type EstadoDoItem = ReturnType<typeof estadoDoItem>;

/** Selo do item (no cartão e no índice): diverge, aviso, feito ou "3/7". */
export function estadoDoItem(item: ItemDb, medicao: Medicao | undefined) {
  const p = progressoItem(item, medicao);
  const contagem = `${p.preenchidos}/${p.total}`;
  if (itemDiverge(item, medicao)) return { texto: 'Diverge', classe: 'item-estado--diverge' };
  if (avisosDoItem(item, medicao).length > 0)
    return { texto: contagem, classe: 'item-estado--aviso' };
  if (p.preenchidos === p.total) return { texto: `${contagem} feito`, classe: 'item-estado--ok' };
  return { texto: contagem, classe: '' };
}

/**
 * O selo com o ícone do estado. "Diverge" e "feito" se leem pelo texto; o aviso ("3/7") se
 * distingue do neutro pelo triângulo e pelo âmbar (nunca só pela cor).
 */
export function SeloDoItem({ estado }: { estado: EstadoDoItem }) {
  return (
    <span class={`item-estado ${estado.classe}`}>
      {estado.classe === 'item-estado--diverge' && <IconeDiverge />}
      {estado.classe === 'item-estado--aviso' && <IconeAviso />}
      {estado.classe === 'item-estado--ok' && <IconeConfere />}
      {estado.texto}
    </span>
  );
}

/** Altura do que fica preso no alto da tela: a barra e, na ficha, as guias. */
export function alturaFixa(): number {
  const topo = document.querySelector('.topo')?.getBoundingClientRect().height ?? 64;
  const guias = document.querySelector('.guias')?.getBoundingClientRect().height ?? 0;
  return topo + guias;
}

/**
 * Leva o item para o topo da tela, logo abaixo das barras fixas (sem abrir o teclado). Com
 * `'fotos'`, vai direto aos botões de foto do cartão (vindo da guia Fotos).
 */
export function irParaItem(itemId: string, parte?: 'fotos') {
  const cartao = document.getElementById(idDoCartao(itemId));
  if (!cartao) return;
  const fotos = parte === 'fotos' ? cartao.querySelector('.fotos:not(.fotos--placa)') : null;
  if (fotos) {
    // O nome do item fica preso sob as barras: desconta a altura dele também.
    const nome = cartao.querySelector('.item-topo')?.getBoundingClientRect().height ?? 0;
    const y = fotos.getBoundingClientRect().top + window.scrollY - alturaFixa() - nome - 8;
    window.scrollTo(0, y);
    return;
  }
  window.scrollTo(0, cartao.getBoundingClientRect().top + window.scrollY - alturaFixa() - 8);
  cartao.querySelector<HTMLElement>('.item-nome')?.focus({ preventScroll: true });
}

interface Props {
  item: ItemDb;
  medicao: Medicao | undefined;
  /** Os outros itens do equipamento (referência do PCM do mancal no tambor). */
  irmaos: readonly ItemDb[];
  /** Próximo item da guia (null no último). */
  proximo: ItemDb | null;
  /** Desenho que já está aberto no alto da guia: não repete no cartão. */
  desenhoNoTopo?: IdDesenho | null;
  /** Linha MANCAL/ROLAMENTO/BUCHA: o que já foi anotado nos tambores, para conferir. */
  anotadoNosTambores?: string | null;
  onMedicao: (mudar: (atual: Medicao | undefined) => Medicao) => void;
}

export function CartaoItem({
  item,
  medicao,
  irmaos,
  proximo,
  desenhoNoTopo = null,
  anotadoNosTambores = null,
  onMedicao,
}: Props) {
  const template = TEMPLATES[item.tipo];
  const estado = estadoDoItem(item, medicao);
  const avisos = avisosDoItem(item, medicao);
  // Se um campo já mostra a especificação inteira como valor do PCM, não repete aqui.
  const especNoCampo = template.campos.some(
    (c) => valorPcm(c, item, irmaos) === item.especificacao,
  );
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
        <SeloDoItem estado={estado} />
      </div>
      <p class="item-tipo">{template.nome}</p>
      {item.especificacao && !especNoCampo && (
        <p class="item-pcm">
          <span class="rotulo-pcm">PCM:</span> <span class="valor-pcm">{item.especificacao}</span>
        </p>
      )}
      {item.quantidade && <p class="item-qtd">Qtd.: {item.quantidade}</p>}
      {anotadoNosTambores && (
        <p class="item-anotado">
          <span class="rotulo-pcm">Nos tambores:</span> {anotadoNosTambores}
        </p>
      )}
      {item.origem === 'deduzido' && (
        <span class="selo">Não está no PCM — deduzido dos mancais</span>
      )}
      {item.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
      <DesenhosDoItem ids={template.desenhos.filter((d) => d !== desenhoNoTopo)} />
      {/* Motor e redutor: a placa é a primeira coisa a registrar (modelo, série, redução). */}
      {template.fotoPlaca && (
        <FotosDoAlvo alvoId={item.id} nome={item.nome} rotulo="Foto da placa" placa />
      )}

      <div class="campos">
        {template.campos.map((c, k) => (
          <Fragment key={c.id}>
            {/* Bloco dentro do cartão (ex.: o mancal e o rolamento de cada tambor). */}
            {c.grupo && c.grupo !== template.campos[k - 1]?.grupo && (
              <h3 class="campos-grupo">{c.grupo}</h3>
            )}
            <CampoMedicao
              campo={c}
              item={item}
              irmaos={irmaos}
              valor={medicao?.valores[c.id]}
              conferencia={medicao?.conferencia[c.id]}
              onValor={(v) => onMedicao((m) => comValor(m, item.id, c.id, v))}
              onConferencia={(marca) => onMedicao((m) => comConferencia(m, item.id, c.id, marca))}
            />
          </Fragment>
        ))}
      </div>

      {avisos.map((a) => (
        <p key={a} class="aviso aviso--bloco" role="status">
          <IconeAviso />
          {a}
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
          <IconeSetaBaixo />
          Próximo item
        </button>
      )}
    </li>
  );
}
