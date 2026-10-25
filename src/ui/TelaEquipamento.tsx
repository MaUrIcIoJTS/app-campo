import { useLayoutEffect } from 'preact/hooks';
import { proximoEquipamento } from '../dominio/busca.ts';
import { avisoDeEspaco } from '../dominio/fotos.ts';
import { avisosDoItem } from '../dominio/medicao.ts';
import { percentual, progressoItem, somarProgresso } from '../dominio/progresso.ts';
import { CartaoItem, estadoDoItem, irParaItem } from './CartaoItem.tsx';
import { useDados } from './dados.tsx';
import { LinhaBackup } from './LinhaBackup.tsx';
import { irAoProximoCampo } from './foco.ts';
import { useEstadoFotos } from './fotos.ts';
import { ErroAoLerFotos, FotosDoAlvo, ProvedorFotos } from './FotosDoAlvo.tsx';
import { IconeCamera } from './Icones.tsx';
import { esquecerRolagem, guardarRolagem, rolagemDaFicha } from './rolagem.ts';
import { rotas, substituirPor, voltarPara } from './rota.ts';
import { Topo } from './Topo.tsx';

interface Props {
  id: string;
  /** Aba filtrada na lista ('' = todas): "Próximo equipamento" fica dentro dela. */
  abaFiltrada: string;
}

/** Ficha do equipamento: itens com os campos de medição, observações e "próximo". */
export function TelaEquipamento({ id, abaFiltrada }: Props) {
  const { dados, erro, alterarMedicao, alterarNota } = useDados();
  const { espaco } = useEstadoFotos();
  const eq = dados?.equipamentos.find((e) => e.id === id);
  const pronto = !!eq;

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

  const voltar = { href: rotas.lista, rotulo: 'Lista' };
  if (!dados || !eq) {
    return (
      <>
        <Topo voltar={voltar} />
        <main class="tela">
          {erro ? (
            <p class="erro" role="alert">
              ⚠ {erro}
            </p>
          ) : (
            <p class="suave">{dados ? 'Equipamento não encontrado.' : 'Abrindo…'}</p>
          )}
        </main>
      </>
    );
  }

  const itens = dados.itensPorEquipamento.get(id) ?? [];
  const progresso = somarProgresso(itens.map((i) => progressoItem(i, dados.medicoes.get(i.id))));
  const avisos = itens.reduce((s, i) => s + avisosDoItem(i, dados.medicoes.get(i.id)).length, 0);
  const pct = percentual(progresso);
  const proximoEq = proximoEquipamento(dados.equipamentos, id, abaFiltrada);
  const fotos = [id, ...itens.map((i) => i.id)].reduce(
    (s, alvo) => s + (dados.fotosPorAlvo.get(alvo) ?? 0),
    0,
  );
  const avisoEspaco = avisoDeEspaco(espaco);

  return (
    <ProvedorFotos key={id} equipamentoId={id} itemIds={itens.map((i) => i.id)}>
      <Topo voltar={voltar} />
      <main class="tela ficha">
        <section class="cabecalho-eq">
          <p class="eq-aba">{eq.aba}</p>
          <h1 class="titulo-tela">{eq.tag ?? eq.nome}</h1>
          {eq.tag && <p class="cabecalho-nome">{eq.nome}</p>}
          <p class="ficha-progresso">
            <span class="barra" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span class="eq-pct">{pct}%</span>
            <span>{itens.length === 1 ? '1 item' : `${itens.length} itens`}</span>
            {progresso.divergencias > 0 && (
              <span class="eq-diverge">✗ {progresso.divergencias} diverge</span>
            )}
            {avisos > 0 && (
              <span class="eq-aviso">⚠ {avisos === 1 ? '1 aviso' : `${avisos} avisos`}</span>
            )}
            {fotos > 0 && (
              <span class="eq-fotos">
                <IconeCamera />
                {fotos === 1 ? '1 foto' : `${fotos} fotos`}
              </span>
            )}
          </p>
          {eq.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
          {avisoEspaco && (
            <p class="aviso aviso--bloco" role="status">
              ⚠ {avisoEspaco}
            </p>
          )}
          <ErroAoLerFotos />
          <FotosDoAlvo alvoId={id} nome={eq.tag ?? eq.nome} rotulo="Foto do equipamento" comPlaca />
        </section>

        {itens.length > 2 && (
          <details class="indice">
            <summary class="indice-resumo">Ir para item…</summary>
            <ol class="indice-lista">
              {itens.map((i) => {
                const estado = estadoDoItem(i, dados.medicoes.get(i.id));
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      class="indice-item"
                      onClick={(e) => {
                        const indice = e.currentTarget.closest('details');
                        if (indice) indice.open = false;
                        irParaItem(i.id);
                      }}
                    >
                      <span class="indice-nome">{i.nome}</span>
                      <span class={`item-estado ${estado.classe}`}>{estado.texto}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </details>
        )}

        <ol class="itens">
          {itens.map((i, k) => (
            <CartaoItem
              key={i.id}
              item={i}
              medicao={dados.medicoes.get(i.id)}
              proximo={itens[k + 1] ?? null}
              onMedicao={(mudar) => alterarMedicao(i.id, mudar)}
            />
          ))}
        </ol>

        <section class="cartao obs-eq">
          <label class="campo-med-rotulo" for="obs-eq">
            Observação do equipamento
          </label>
          <textarea
            id="obs-eq"
            class="campo campo-texto"
            rows={3}
            enterkeyhint="done"
            value={dados.notas.get(id)?.observacao ?? ''}
            onInput={(e) => alterarNota(id, e.currentTarget.value)}
            onKeyDown={irAoProximoCampo}
            data-campo-ficha
          />
        </section>

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
              <span>Próximo equipamento ›</span>
              <span class="botao-sub">
                {proximoEq.tag ?? proximoEq.nome}
                {proximoEq.aba !== eq.aba && ` · ${proximoEq.aba}`}
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
            ‹ Voltar para a lista
          </a>
        </nav>
      </main>
    </ProvedorFotos>
  );
}
