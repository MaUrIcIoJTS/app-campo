import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useMemo } from 'preact/hooks';
import { filtrarEquipamentos } from '../dominio/busca.ts';
import { avisosDoItem } from '../dominio/medicao.ts';
import { percentual, progressoItem, somarProgresso, type Progresso } from '../dominio/progresso.ts';
import type { Dados } from '../db/repositorio.ts';
import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { AlertaAparelho, type StatusAparelho } from './RodapeAparelho.tsx';
import { Topo } from './Topo.tsx';

export interface Filtros {
  termo: string;
  aba: string;
}

interface Props {
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  rodape: ComponentChildren;
  status: StatusAparelho;
}

/** Posição da rolagem ao sair para a ficha — volta no mesmo lugar. */
let rolagemSalva = 0;

interface Resumo {
  progresso: Progresso;
  fotos: number;
  /** Avisos de conferência (ex.: tapete com LD ≠ LE). */
  avisos: number;
}

function resumir(dados: Dados): Map<string, Resumo> {
  const mapa = new Map<string, Resumo>();
  for (const eq of dados.equipamentos) {
    const itens = dados.itensPorEquipamento.get(eq.id) ?? [];
    mapa.set(eq.id, {
      progresso: somarProgresso(itens.map((i) => progressoItem(i, dados.medicoes.get(i.id)))),
      fotos:
        (dados.fotosPorAlvo.get(eq.id) ?? 0) +
        itens.reduce((s, i) => s + (dados.fotosPorAlvo.get(i.id) ?? 0), 0),
      avisos: itens.reduce((s, i) => s + avisosDoItem(i, dados.medicoes.get(i.id)).length, 0),
    });
  }
  return mapa;
}

export function TelaLista({ filtros, onFiltros, rodape, status }: Props) {
  const { dados, erro } = useDados();
  const pronto = dados !== null;

  useLayoutEffect(() => {
    if (!pronto) return;
    window.scrollTo(0, rolagemSalva);
    return () => {
      rolagemSalva = window.scrollY;
    };
  }, [pronto]);

  const abas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const e of dados?.equipamentos ?? []) contagem.set(e.aba, (contagem.get(e.aba) ?? 0) + 1);
    return [...contagem];
  }, [dados]);
  const resumos = useMemo(() => (dados ? resumir(dados) : new Map<string, Resumo>()), [dados]);
  const filtrados = useMemo(
    () => filtrarEquipamentos(dados?.equipamentos ?? [], filtros.termo, filtros.aba),
    [dados, filtros],
  );

  const topo = <Topo titulo={{ curto: 'PCM', completo: 'Levantamento PCM' }} />;
  if (erro) {
    return (
      <>
        {topo}
        <main class="tela">
          <p class="erro">{erro}</p>
        </main>
      </>
    );
  }
  if (!dados) {
    return (
      <>
        {topo}
        <main class="tela">
          <p class="suave">Abrindo dados do aparelho…</p>
        </main>
      </>
    );
  }

  const total = dados.equipamentos.length;
  if (total === 0) {
    return (
      <>
        {topo}
        <main class="tela">
          <AlertaAparelho status={status} />
          <section class="cartao vazio">
            <h2>Nenhum PCM neste aparelho</h2>
            <p>Importe a planilha do PCM (.xls ou .xlsx). Ela fica só neste celular.</p>
            <a class="botao botao--grande" href={rotas.importar}>
              Importar PCM
            </a>
          </section>
          {rodape}
        </main>
      </>
    );
  }

  return (
    <>
      {topo}
      <main class="tela">
        <AlertaAparelho status={status} />
        <div class="filtros">
          <div class="busca">
            <input
              type="search"
              class="campo"
              placeholder="Buscar TAG ou nome"
              aria-label="Buscar equipamento por TAG ou nome"
              value={filtros.termo}
              onInput={(e) => onFiltros({ ...filtros, termo: e.currentTarget.value })}
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="characters"
              spellcheck={false}
              onKeyDown={(e) => {
                // "Buscar" no teclado: fecha o teclado para ver os resultados
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
            {filtros.termo && (
              <button
                type="button"
                class="busca-limpar"
                aria-label="Limpar busca"
                onClick={() => onFiltros({ ...filtros, termo: '' })}
              >
                ×
              </button>
            )}
          </div>
          <select
            class="campo"
            aria-label="Filtrar por aba"
            value={filtros.aba}
            onChange={(e) => onFiltros({ ...filtros, aba: e.currentTarget.value })}
          >
            <option value="">Todas as abas ({total})</option>
            {abas.map(([aba, n]) => (
              <option key={aba} value={aba}>
                {aba} ({n})
              </option>
            ))}
          </select>
        </div>

        <p class="contagem" aria-live="polite">
          {filtrados.length === total
            ? `${total} equipamentos`
            : `${filtrados.length} de ${total} equipamentos`}
        </p>

        {filtrados.length === 0 ? (
          <div class="cartao vazio">
            <p>Nada encontrado para “{filtros.termo}”.</p>
            <button type="button" class="botao" onClick={() => onFiltros({ termo: '', aba: '' })}>
              Limpar filtros
            </button>
          </div>
        ) : (
          <ul class="lista-eq">
            {filtrados.map((eq) => {
              const r = resumos.get(eq.id);
              const pct = r ? percentual(r.progresso) : 0;
              const diverg = r?.progresso.divergencias ?? 0;
              const fotos = r?.fotos ?? 0;
              return (
                <li key={eq.id}>
                  <a class="eq" href={rotas.equipamento(eq.id)}>
                    <span class="eq-linha1">
                      <span class={eq.tag ? 'eq-tag' : 'eq-tag eq-tag--nome'}>
                        {eq.tag ?? eq.nome}
                      </span>
                      {!filtros.aba && <span class="eq-aba">{eq.aba}</span>}
                    </span>
                    {eq.tag && <span class="eq-nome">{eq.nome}</span>}
                    <span class="eq-linha3">
                      <span class="barra" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span class="eq-pct">{pct}%</span>
                      {fotos > 0 && <span>{fotos === 1 ? '1 foto' : `${fotos} fotos`}</span>}
                      {diverg > 0 && <span class="eq-diverge">✗ {diverg} diverge</span>}
                      {(r?.avisos ?? 0) > 0 && <span class="eq-aviso">⚠ aviso</span>}
                      {eq.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {rodape}
      </main>
    </>
  );
}
