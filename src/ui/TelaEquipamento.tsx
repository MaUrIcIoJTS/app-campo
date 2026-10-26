import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { ItemDb, Medicao } from '../db/esquema.ts';
import { proximoEquipamento } from '../dominio/busca.ts';
import { avisoDeEspaco } from '../dominio/fotos.ts';
import {
  anotadoNosTambores,
  guiaDoItem,
  guiasDaFicha,
  guiaValida,
  proximaGuia,
  type Guia,
  type IdGuia,
} from '../dominio/guias.ts';
import { avisosDoItem, itemDiverge } from '../dominio/medicao.ts';
import { percentual, progressoItem, somarProgresso } from '../dominio/progresso.ts';
import { CartaoItem, estadoDoItem, irParaItem, SeloDoItem } from './CartaoItem.tsx';
import { useDados } from './dados.tsx';
import { DesenhoDaGuia, desenhoDaGuia } from './DesenhoDaGuia.tsx';
import { LinhaBackup } from './LinhaBackup.tsx';
import { irAoProximoCampo } from './foco.ts';
import { useEstadoFotos } from './fotos.ts';
import { ErroAoLerFotos, FotosDoAlvo, ProvedorFotos } from './FotosDoAlvo.tsx';
import { Guias, ID_PAINEL, idDaGuia, type GuiaNaBarra } from './Guias.tsx';
import {
  IconeAvancar,
  IconeAviso,
  IconeCamera,
  IconeConfere,
  IconeDiverge,
  IconeErro,
  IconeVoltar,
} from './Icones.tsx';
import {
  esquecerRolagem,
  guardarGuia,
  guardarRolagem,
  guardarRolagemDaGuia,
  guiaDaFicha,
  rolagemDaFicha,
  rolagemDaGuia,
} from './rolagem.ts';
import { rotas, substituirPor, voltarPara } from './rota.ts';
import { Topo } from './Topo.tsx';

interface Props {
  id: string;
  /** Guia pedida no endereço (`#/equipamento/<id>/<guia>`); sem ela, a última aberta. */
  guia: string | undefined;
  /** Aba filtrada na lista ('' = todas): "Próximo equipamento" fica dentro dela. */
  abaFiltrada: string;
}

const SEM_ITENS: readonly ItemDb[] = [];

/** Título de cada guia, no alto do painel (como no protótipo de campo). */
const TITULOS: Partial<Record<IdGuia, string>> = {
  pcm: 'Dados do PCM',
  correia: 'Correia e centro a centro',
  notas: 'Observações',
};
const contarItens = (n: number) => (n === 1 ? '1 item' : `${n} itens`);
const contarFotos = (n: number) => (n === 1 ? '1 foto' : `${n} fotos`);

/** ✓ quando todos os itens da guia estão feitos; ✗ se algum campo diverge. */
function estadoDaGuia(itens: readonly ItemDb[], medicoes: ReadonlyMap<string, Medicao>) {
  if (itens.some((i) => itemDiverge(i, medicoes.get(i.id)))) return 'diverge';
  const p = somarProgresso(itens.map((i) => progressoItem(i, medicoes.get(i.id))));
  return itens.length > 0 && p.preenchidos === p.total ? 'feito' : null;
}

/** Rolagem em que a guia começa (as guias presas logo abaixo do topo). */
function comecoDaGuia(): number | null {
  const marca = document.querySelector('.guias-sentinela');
  if (!marca) return null;
  const topo = document.querySelector('.topo')?.getBoundingClientRect().height ?? 64;
  return marca.getBoundingClientRect().top + window.scrollY - topo;
}

/** Sobe a tela até o começo da guia, se ela estiver mais abaixo. */
function rolarAoComecoDaGuia() {
  const y = comecoDaGuia();
  if (y !== null && window.scrollY > y) window.scrollTo(0, y);
}

/** Como abrir a guia: no item pedido, no começo ("Seguir") ou onde o técnico parou nela. */
interface AoAbrir {
  item?: string;
  fotos?: boolean;
  doComeco?: boolean;
}

/**
 * Ficha do equipamento em guias, como o técnico mede no campo: PCM, Correia, Tambores,
 * Roletes, Acionamento, Outros, Fotos e Notas. A guia aberta fica no endereço (o Android
 * recarregar a página depois da câmera volta nela) sem empilhar histórico.
 */
export function TelaEquipamento({ id, guia: guiaPedida, abaFiltrada }: Props) {
  const { dados, erro, alterarMedicao, alterarNota } = useDados();
  const { espaco } = useEstadoFotos();
  const eq = dados?.equipamentos.find((e) => e.id === id);
  const pronto = !!eq;
  const itens = dados?.itensPorEquipamento.get(id) ?? SEM_ITENS;
  const guias = useMemo(() => guiasDaFicha(itens), [itens]);
  const guia = guiaValida(guias, guiaPedida ?? guiaDaFicha(id));

  // Volta onde parou nesta ficha (ou no topo, na primeira vez). A posição vem dos eventos de
  // rolagem; ao esconder/recarregar o app (câmera) ainda é esta ficha na tela, então lê direto.
  useLayoutEffect(() => {
    if (!pronto) return;
    window.scrollTo(0, rolagemDaFicha(id));
    let y = window.scrollY;
    const rolou = () => (y = window.scrollY);
    const saindo = () => guardarRolagem(id, window.scrollY);
    const escondeu = () => document.visibilityState === 'hidden' && saindo();
    window.addEventListener('scroll', rolou, { passive: true });
    window.addEventListener('pagehide', saindo);
    document.addEventListener('visibilitychange', escondeu);
    return () => {
      window.removeEventListener('scroll', rolou);
      window.removeEventListener('pagehide', saindo);
      document.removeEventListener('visibilitychange', escondeu);
      guardarRolagem(id, y);
    };
  }, [id, pronto]);

  // A guia lembrada é sempre a que está aberta (também quando o topo troca de guia sozinho,
  // ex.: "Foto não salva"). Só com a ficha carregada: enquanto abre, não há itens e a guia
  // calculada seria a do PCM.
  useEffect(() => {
    if (pronto) guardarGuia(id, guia);
  }, [id, guia, pronto]);

  // Depois de trocar de guia: vai ao item pedido (PCM, Fotos), ao começo ("Seguir") ou onde o
  // técnico parou nesta guia (voltou para conferir algo e quer continuar de onde estava).
  const aoTrocarRef = useRef<AoAbrir | null>(null);
  useLayoutEffect(() => {
    const pedido = aoTrocarRef.current;
    if (!pedido) return;
    aoTrocarRef.current = null;
    if (pedido.item) return irParaItem(pedido.item, pedido.fotos ? 'fotos' : undefined);
    const parou = pedido.doComeco ? null : rolagemDaGuia(id, guia);
    const comeco = comecoDaGuia();
    if (parou !== null && comeco !== null && parou > comeco) window.scrollTo(0, parou);
    else rolarAoComecoDaGuia();
  }, [id, guia]);

  function abrirGuia(nova: IdGuia, aoAbrir: AoAbrir = {}) {
    if (nova === guia) {
      if (aoAbrir.item) irParaItem(aoAbrir.item, aoAbrir.fotos ? 'fotos' : undefined);
      return;
    }
    guardarRolagemDaGuia(id, guia, window.scrollY);
    aoTrocarRef.current = aoAbrir;
    substituirPor(rotas.equipamento(id, nova));
  }

  const irAoItem = (i: ItemDb, fotos = false) => abrirGuia(guiaDoItem(i), { item: i.id, fotos });

  const voltar = { href: rotas.lista, rotulo: 'Lista' };
  if (!dados || !eq) {
    return (
      <>
        <Topo voltar={voltar} />
        <main class="tela">
          {erro ? (
            <p class="erro" role="alert">
              <IconeErro />
              {erro}
            </p>
          ) : (
            <p class="suave">{dados ? 'Equipamento não encontrado.' : 'Abrindo…'}</p>
          )}
        </main>
      </>
    );
  }

  const progresso = somarProgresso(itens.map((i) => progressoItem(i, dados.medicoes.get(i.id))));
  const avisos = itens.reduce((s, i) => s + avisosDoItem(i, dados.medicoes.get(i.id)).length, 0);
  const pct = percentual(progresso);
  const fotos = [id, ...itens.map((i) => i.id)].reduce(
    (s, alvo) => s + (dados.fotosPorAlvo.get(alvo) ?? 0),
    0,
  );
  const avisoEspaco = avisoDeEspaco(espaco);
  const temNota = !!dados.notas.get(id)?.observacao.trim();
  const naBarra: GuiaNaBarra[] = guias.map((g) => ({
    id: g.id,
    rotulo: g.rotulo,
    estado: ['pcm', 'fotos', 'notas'].includes(g.id) ? null : estadoDaGuia(g.itens, dados.medicoes),
    // Fotos: quantas; Notas: 1 se já há observação (para não ficar esquecida na última guia).
    contagem: g.id === 'fotos' ? fotos : g.id === 'notas' && temNota ? 1 : undefined,
  }));
  // Guias de medida com item por fazer: aparecem antes de "Próximo equipamento".
  const faltando = guias.flatMap((g) => {
    if (['pcm', 'fotos', 'notas'].includes(g.id)) return [];
    const n = g.itens.filter((i) => {
      const p = progressoItem(i, dados.medicoes.get(i.id));
      return p.preenchidos < p.total;
    }).length;
    return n > 0 ? [{ id: g.id, rotulo: g.rotulo, n }] : [];
  });
  const atual = guias.find((g) => g.id === guia)!;
  const seguinte = proximaGuia(guias, guia);

  return (
    <ProvedorFotos key={id} equipamentoId={id} itemIds={itens.map((i) => i.id)}>
      <Topo voltar={voltar} contexto={eq.tag ?? undefined} />
      <main class="tela ficha">
        <section class="cabecalho-eq">
          <h1 class="titulo-tela">{eq.tag ?? eq.nome}</h1>
          {eq.tag && <p class="cabecalho-nome">{eq.nome}</p>}
          <p class="cabecalho-apoio">
            {eq.aba} · {contarItens(itens.length)}
          </p>
          <p class="ficha-progresso">
            <span class="barra" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span class="eq-pct">{pct}%</span>
            {progresso.divergencias > 0 && (
              <span class="eq-diverge">
                <IconeDiverge />
                {progresso.divergencias} diverge
              </span>
            )}
            {avisos > 0 && (
              <span class="eq-aviso">
                <IconeAviso />
                {avisos === 1 ? '1 aviso' : `${avisos} avisos`}
              </span>
            )}
            {fotos > 0 && (
              <span class="eq-fotos">
                <IconeCamera />
                {contarFotos(fotos)}
              </span>
            )}
          </p>
          {eq.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
          {avisoEspaco && (
            <p class="aviso aviso--bloco" role="status">
              <IconeAviso />
              {avisoEspaco}
            </p>
          )}
          <ErroAoLerFotos />
        </section>

        <Guias guias={naBarra} atual={guia} onEscolher={(g) => abrirGuia(g)} />

        <section
          id={ID_PAINEL}
          class="guia-painel"
          role="tabpanel"
          aria-labelledby={idDaGuia(guia)}
        >
          <h2 class="guia-titulo">{TITULOS[guia] ?? atual.rotulo}</h2>
          {guia === 'pcm' ? (
            <GuiaPcm itens={itens} medicoes={dados.medicoes} onItem={(i) => irAoItem(i)} />
          ) : guia === 'fotos' ? (
            <GuiaFotos
              equipamento={{ id, nome: eq.tag ?? eq.nome }}
              itens={itens}
              fotosPorAlvo={dados.fotosPorAlvo}
              onItem={(i) => irAoItem(i, true)}
            />
          ) : guia === 'notas' ? (
            <section class="cartao obs-eq">
              <label class="campo-med-rotulo" for="obs-eq">
                Observação do equipamento
              </label>
              <textarea
                id="obs-eq"
                class="campo campo-texto"
                rows={4}
                enterkeyhint="done"
                value={dados.notas.get(id)?.observacao ?? ''}
                onInput={(e) => alterarNota(id, e.currentTarget.value)}
                onKeyDown={irAoProximoCampo}
                data-campo-ficha
              />
            </section>
          ) : (
            <ItensDaGuia
              guia={atual}
              itens={itens}
              medicoes={dados.medicoes}
              onMedicao={alterarMedicao}
            />
          )}

          {seguinte ? (
            <nav class="fim-guia" aria-label="Seguir">
              <button
                type="button"
                class="botao botao--grande botao--proximo"
                onClick={() => abrirGuia(seguinte.id, { doComeco: true })}
              >
                <span class="botao-linha">
                  Seguir para {seguinte.rotulo}
                  <IconeAvancar />
                </span>
                <span class="botao-sub">
                  {seguinte.id === 'fotos'
                    ? fotos > 0
                      ? contarFotos(fotos)
                      : 'Nenhuma foto ainda'
                    : seguinte.id === 'notas'
                      ? 'Observação e próximo equipamento'
                      : contarItens(seguinte.itens.length)}
                </span>
              </button>
            </nav>
          ) : (
            <>
              <OQueFalta faltando={faltando} onGuia={(g) => abrirGuia(g, { doComeco: true })} />
              <FimDaFicha equipamento={eq} abaFiltrada={abaFiltrada} />
            </>
          )}
        </section>
      </main>
    </ProvedorFotos>
  );
}

/** Correia, Tambores, Roletes…: os cartões dos itens; "Próximo item" anda dentro da guia. */
function ItensDaGuia({
  guia,
  itens,
  medicoes,
  onMedicao,
}: {
  guia: Guia<ItemDb>;
  itens: readonly ItemDb[];
  medicoes: ReadonlyMap<string, Medicao>;
  onMedicao: (itemId: string, mudar: (atual: Medicao | undefined) => Medicao) => void;
}) {
  const cartao = (i: ItemDb) => {
    const k = guia.itens.indexOf(i);
    return (
      <CartaoItem
        key={i.id}
        item={i}
        medicao={medicoes.get(i.id)}
        irmaos={itens}
        proximo={guia.itens[k + 1] ?? null}
        desenhoNoTopo={desenho?.id}
        anotadoNosTambores={anotadoNosTambores(i, tambores, (t) => medicoes.get(t)?.valores)}
        onMedicao={(mudar) => onMedicao(i.id, mudar)}
      />
    );
  };
  // Tambores: cada tambor (com o seu mancal) e, depois, as linhas de mancal do PCM.
  const tambores = guia.id === 'tambores' ? guia.itens.filter((i) => i.tipo === 'tambor') : [];
  const desenho = desenhoDaGuia(guia.id, tambores.length > 0);
  const linhasPcm = tambores.length > 0 ? guia.itens.filter((i) => i.tipo !== 'tambor') : [];
  const topo = desenho && <DesenhoDaGuia key={desenho.id} {...desenho} />;
  if (linhasPcm.length === 0)
    return (
      <>
        {topo}
        <ol class="itens">{guia.itens.map(cartao)}</ol>
      </>
    );
  return (
    <>
      {topo}
      <ol class="itens">{tambores.map(cartao)}</ol>
      <h2 class="guia-subtitulo">Mancal, rolamento e bucha no PCM</h2>
      <p class="guia-dica">
        Estas linhas vão para a planilha do cliente: confira o código e a quantidade.
      </p>
      <ol class="itens">{linhasPcm.map(cartao)}</ol>
    </>
  );
}

/** Antes de sair do equipamento: as guias com item por medir (tocar abre a guia). */
function OQueFalta({
  faltando,
  onGuia,
}: {
  faltando: readonly { id: IdGuia; rotulo: string; n: number }[];
  onGuia: (g: IdGuia) => void;
}) {
  if (faltando.length === 0)
    return (
      <p class="falta-tudo-feito">
        <IconeConfere />
        Todas as guias medidas.
      </p>
    );
  return (
    <section class="falta">
      <h2 class="guia-subtitulo">Ainda falta medir</h2>
      <ul class="cartao pcm-linhas">
        {faltando.map((g) => (
          <li key={g.id}>
            <button type="button" class="pcm-linha pcm-linha--fotos" onClick={() => onGuia(g.id)}>
              <span class="pcm-linha-nome">{g.rotulo}</span>
              <span class="pcm-linha-fotos">{g.n === 1 ? '1 item' : `${g.n} itens`}</span>
              <IconeAvancar />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** As linhas do PCM como estão na planilha; tocar numa leva ao item, na guia dele. */
function GuiaPcm({
  itens,
  medicoes,
  onItem,
}: {
  itens: readonly ItemDb[];
  medicoes: ReadonlyMap<string, Medicao>;
  onItem: (i: ItemDb) => void;
}) {
  if (itens.length === 0) return <p class="suave">Este equipamento não tem itens no PCM.</p>;
  return (
    <>
      <p class="guia-dica">Como está na planilha. Toque num item para medir.</p>
      <ol class="cartao pcm-linhas">
        {itens.map((i) => (
          <li key={i.id}>
            <button type="button" class="pcm-linha" onClick={() => onItem(i)}>
              <span class="pcm-linha-topo">
                <span class="pcm-linha-nome">{i.nome}</span>
                <SeloDoItem estado={estadoDoItem(i, medicoes.get(i.id))} />
              </span>
              <span class="pcm-linha-espec">
                {i.origem === 'deduzido'
                  ? 'Não está no PCM — deduzido dos mancais'
                  : i.especificacao || '—'}
              </span>
              {i.quantidade && i.origem !== 'deduzido' && (
                <span class="pcm-linha-qtd">Qtd.: {i.quantidade}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Fotos do equipamento e, de cada item, quantas tem (tocar leva ao item para fotografar). */
function GuiaFotos({
  equipamento,
  itens,
  fotosPorAlvo,
  onItem,
}: {
  equipamento: { id: string; nome: string };
  itens: readonly ItemDb[];
  fotosPorAlvo: ReadonlyMap<string, number>;
  onItem: (i: ItemDb) => void;
}) {
  return (
    <>
      <section class="cartao guia-fotos-eq">
        <h2 class="guia-subtitulo">Equipamento</h2>
        <FotosDoAlvo alvoId={equipamento.id} nome={equipamento.nome} rotulo="Tirar foto" comPlaca />
      </section>
      {itens.length > 0 && (
        <>
          <h2 class="guia-subtitulo">Fotos dos itens</h2>
          <ul class="cartao pcm-linhas">
            {itens.map((i) => {
              const n = fotosPorAlvo.get(i.id) ?? 0;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    class="pcm-linha pcm-linha--fotos"
                    onClick={() => onItem(i)}
                  >
                    <span class="pcm-linha-nome">{i.nome}</span>
                    <span class={n > 0 ? 'pcm-linha-fotos' : 'pcm-linha-fotos suave'}>
                      {n > 0 ? contarFotos(n) : 'Sem foto'}
                    </span>
                    <IconeAvancar />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/** Fim da última guia: lembrete de backup, próximo equipamento e volta para a lista. */
function FimDaFicha({
  equipamento,
  abaFiltrada,
}: {
  equipamento: { id: string; aba: string };
  abaFiltrada: string;
}) {
  const { dados } = useDados();
  if (!dados) return null;
  const proximoEq = proximoEquipamento(dados.equipamentos, equipamento.id, abaFiltrada);
  return (
    <nav class="fim-ficha" aria-label="Próximo">
      {/* Quem vai de ficha em ficha não passa pela lista: o lembrete aparece aqui também. */}
      <LinhaBackup dados={dados} soAtrasado />
      {proximoEq ? (
        <a
          class="botao botao--grande botao--proximo"
          href={rotas.equipamento(proximoEq.id)}
          onClick={(e) => {
            e.preventDefault();
            esquecerRolagem(proximoEq.id);
            substituirPor(rotas.equipamento(proximoEq.id));
          }}
        >
          <span class="botao-linha">
            Próximo equipamento
            <IconeAvancar />
          </span>
          <span class="botao-sub">
            {proximoEq.tag ?? proximoEq.nome}
            {proximoEq.aba !== equipamento.aba && ` · ${proximoEq.aba}`}
          </span>
        </a>
      ) : (
        <p class="suave">
          {abaFiltrada
            ? `Último equipamento de ${abaFiltrada}.`
            : 'Este é o último equipamento do PCM.'}
        </p>
      )}
      <a
        class="botao botao--secundario botao--grande"
        href={rotas.lista}
        onClick={(e) => {
          e.preventDefault();
          voltarPara(rotas.lista);
        }}
      >
        <IconeVoltar />
        Voltar para a lista
      </a>
    </nav>
  );
}
