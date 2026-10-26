/**
 * PROTÓTIPO (fora do app): a guia "Exterior" com o croqui, para aprovar antes de codar.
 * Abrir com `npm run dev` em /prototipo/croqui/?forma=aero (ou peneira) e &tema=escuro.
 */
import { render } from 'preact';
import { useState } from 'preact/hooks';
import '../../src/estilos.css';
import './croqui.css';
import type { IdGuia } from '../../src/dominio/guias.ts';
import { formatarNumero } from '../../src/dominio/numeros.ts';
import { Guias, type GuiaNaBarra } from '../../src/ui/Guias.tsx';
import { IconeCamera, IconeConfere, IconeFeito, IconeVoltar } from '../../src/ui/Icones.tsx';
import { CaixaInclinada, CilindroCone, type EstadoCota } from './desenhos.tsx';

interface CampoCroqui {
  letra: string;
  rotulo: string;
  unidade?: string;
  /** Texto livre (ex.: "600 × 300"); senão, número. */
  texto?: boolean;
  opcoes?: readonly string[];
  /** Ø que também pode ser medido pelo perímetro (trena em volta). */
  perimetro?: boolean;
  dica?: string;
}

interface Valor {
  valor?: string;
  semAcesso?: boolean;
  estimado?: boolean;
  perimetro?: string;
}

interface Forma {
  tag: string;
  nome: string;
  aba: string;
  formato: string;
  guias: GuiaNaBarra[];
  campos: CampoCroqui[];
  inicial: Record<string, Valor>;
  Desenho: typeof CilindroCone;
  legenda: string;
  seguir: string;
}

const guia = (id: string, rotulo: string, extra: Partial<GuiaNaBarra> = {}): GuiaNaBarra => ({
  id: id as IdGuia,
  rotulo,
  estado: null,
  ...extra,
});

const FORMAS: Record<string, Forma> = {
  aero: {
    tag: 'XA-AS-01',
    nome: 'AEROSEPARADOR 01 - TESTE XA-AS-01',
    aba: 'AREA 2',
    formato: 'cilindro + cone',
    guias: [
      guia('pcm', 'PCM'),
      guia('exterior', 'Exterior'),
      guia('tambores', 'Mancais'),
      guia('acionamento', 'Acionamento'),
      guia('outros', 'Outros'),
      guia('fotos', 'Fotos', { contagem: 1 }),
      guia('notas', 'Notas'),
    ],
    campos: [
      { letra: 'A', rotulo: 'Ø do corpo', unidade: 'mm', perimetro: true },
      { letra: 'B', rotulo: 'Altura do cilindro', unidade: 'mm' },
      { letra: 'C', rotulo: 'Altura do cone', unidade: 'mm' },
      { letra: 'D', rotulo: 'Ø da saída de baixo', unidade: 'mm' },
      { letra: 'E', rotulo: 'Ø do duto de cima', unidade: 'mm' },
      { letra: 'F', rotulo: 'Entrada (L × A)', unidade: 'mm', texto: true, dica: 'Ex.: 600 × 300' },
    ],
    inicial: {
      A: { perimetro: '6000' },
      B: { valor: '2400' },
      C: { valor: '1800', estimado: true },
      E: { semAcesso: true },
    },
    Desenho: CilindroCone,
    legenda: 'Toque numa letra para ir ao campo.\nCheia: medida. Vazia: falta. Cinza: sem acesso.',
    seguir: 'Mancais',
  },
  peneira: {
    tag: 'XB-PN-01',
    nome: 'PENEIRA VIBRATÓRIA 01 - TESTE XB-PN-01',
    aba: 'SECAGEM E CLASSIFICAÇÃO',
    formato: 'caixa inclinada',
    guias: [
      guia('pcm', 'PCM'),
      guia('exterior', 'Exterior'),
      guia('tambores', 'Mancais'),
      guia('acionamento', 'Acionamento'),
      guia('outros', 'Outros'),
      guia('fotos', 'Fotos'),
      guia('notas', 'Notas'),
    ],
    campos: [
      { letra: 'A', rotulo: 'Comprimento da caixa', unidade: 'mm' },
      { letra: 'B', rotulo: 'Largura da caixa', unidade: 'mm' },
      { letra: 'C', rotulo: 'Altura da caixa', unidade: 'mm' },
      {
        letra: 'D',
        rotulo: 'Inclinação',
        unidade: '°',
        dica: 'Celular sobre a caixa, com um app de nível.',
      },
      { letra: 'E', rotulo: 'Nº de decks', opcoes: ['1', '2', '3', '4'] },
    ],
    inicial: { A: { valor: '4800' }, B: { valor: '1800' }, E: { valor: '2' } },
    Desenho: CaixaInclinada,
    legenda: 'Toque numa letra para ir ao campo.\nCheia: medida. Vazia: falta. Cinza: sem acesso.',
    seguir: 'Mancais',
  },
};

const diametroDoPerimetro = (p: string) => {
  const n = Number(p.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n / Math.PI) : null;
};

function estadoDa(v: Valor | undefined): EstadoCota {
  if (v?.semAcesso) return 'semAcesso';
  return v?.valor?.trim() || (v?.perimetro && diametroDoPerimetro(v.perimetro))
    ? 'medida'
    : 'falta';
}

const idDoCampo = (letra: string) => `croqui-${letra}`;

function Campo({
  campo,
  v,
  mudar,
}: {
  campo: CampoCroqui;
  v: Valor;
  mudar: (novo: Valor) => void;
}) {
  const id = idDoCampo(campo.letra);
  const estado = estadoDa(v);
  const diametro = v.perimetro ? diametroDoPerimetro(v.perimetro) : null;
  const usandoPerimetro = v.perimetro !== undefined;
  return (
    <div class="campo-med" data-conferencia={v.semAcesso ? 'naoTem' : undefined}>
      <div class="campo-med-topo">
        <label class="campo-med-rotulo" for={id}>
          <span class={`letra-campo letra-campo--${estado}`}>{campo.letra}</span>
          {campo.rotulo}
          {campo.unidade && <span class="unidade"> ({campo.unidade})</span>}
        </label>
      </div>
      {campo.opcoes ? (
        <div class="opcoes" role="group" id={id}>
          {campo.opcoes.map((o) => (
            <button
              key={o}
              type="button"
              class="opcao"
              aria-pressed={v.valor === o}
              onClick={() => mudar({ ...v, valor: v.valor === o ? '' : o })}
            >
              {v.valor === o && <IconeConfere />}
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div class="campo-med-linha">
            <input
              id={id}
              class="campo campo-med-input"
              type="text"
              inputMode={campo.texto ? 'text' : 'decimal'}
              autoComplete="off"
              placeholder={usandoPerimetro && diametro ? formatarNumero(diametro) : undefined}
              disabled={usandoPerimetro || v.semAcesso}
              value={v.semAcesso ? '' : `${v.estimado && v.valor ? '≈ ' : ''}${v.valor ?? ''}`}
              onInput={(e) => mudar({ ...v, valor: e.currentTarget.value.replace(/^≈\s*/, '') })}
            />
            <button
              type="button"
              class="nao-tem"
              aria-pressed={!!v.semAcesso}
              onClick={() => mudar({ ...v, semAcesso: !v.semAcesso })}
            >
              {v.semAcesso && <IconeConfere />}
              Sem acesso
            </button>
          </div>
          {!v.semAcesso && (
            <div class="croqui-extras">
              {!campo.texto && !usandoPerimetro && !!(v.valor?.trim() || v.estimado) && (
                <button
                  type="button"
                  class="opcao opcao--chip"
                  aria-pressed={!!v.estimado}
                  onClick={() => mudar({ ...v, estimado: !v.estimado })}
                >
                  {v.estimado && <IconeConfere />}≈ Estimado
                </button>
              )}
              {campo.perimetro && (
                <button
                  type="button"
                  class="opcao opcao--chip"
                  aria-pressed={usandoPerimetro}
                  onClick={() => mudar({ ...v, perimetro: usandoPerimetro ? undefined : '' })}
                >
                  {usandoPerimetro && <IconeConfere />}
                  Medi o perímetro
                </button>
              )}
            </div>
          )}
          {usandoPerimetro && !v.semAcesso && (
            <div class="croqui-perimetro">
              <label class="campo-med-rotulo" for={`${id}-perimetro`}>
                Perímetro <span class="unidade">(mm)</span>
              </label>
              <input
                id={`${id}-perimetro`}
                class="campo campo-med-input"
                type="text"
                inputMode="decimal"
                value={v.perimetro}
                onInput={(e) => mudar({ ...v, perimetro: e.currentTarget.value })}
              />
              {diametro && (
                <p class="campo-med-info">
                  Ø = {formatarNumero(Number(v.perimetro))} ÷ π ={' '}
                  <strong>{formatarNumero(diametro)} mm</strong>
                </p>
              )}
            </div>
          )}
        </>
      )}
      {campo.dica && <p class="campo-med-info">{campo.dica}</p>}
    </div>
  );
}

function Prototipo({ forma }: { forma: Forma }) {
  const [valores, setValores] = useState<Record<string, Valor>>(forma.inicial);
  const estados = Object.fromEntries(
    forma.campos.map((c) => [c.letra, estadoDa(valores[c.letra])]),
  );
  const feitos = Object.values(estados).filter((e) => e !== 'falta').length;
  const irAoCampo = (letra: string) => {
    const el = document.getElementById(idDoCampo(letra));
    el?.closest('.campo-med')?.scrollIntoView({ block: 'center' });
    if (el instanceof HTMLInputElement && !el.disabled) el.focus({ preventScroll: true });
  };
  const { Desenho } = forma;
  return (
    <>
      <header class="topo">
        <a class="topo-voltar" href="#" aria-label="Voltar à lista">
          <IconeVoltar />
        </a>
        <span class="salvo salvo--salvo" role="status">
          <IconeFeito />
          Salvo no aparelho
        </span>
      </header>
      <main class="tela ficha">
        <section class="cabecalho-eq">
          <h1 class="titulo-tela">{forma.tag}</h1>
          <p class="cabecalho-nome">{forma.nome}</p>
          <p class="cabecalho-apoio">{forma.aba} · 9 itens</p>
        </section>
        <Guias guias={forma.guias} atual={'exterior' as IdGuia} onEscolher={() => {}} />
        <section class="guia-painel">
          <h2 class="guia-titulo">Exterior</h2>
          <details class="cartao desenho-guia" open>
            <summary>
              <span class="desenho-guia-titulo">Croqui: {forma.formato}</span>
              <span class="desenho-guia-acao">Ocultar</span>
            </summary>
            <figure class="desenho">
              <Desenho estados={estados} onToque={irAoCampo} />
              <figcaption>{forma.legenda}</figcaption>
            </figure>
          </details>
          <ol class="itens">
            <li class="item cartao">
              <div class="item-topo">
                <h2 class="item-nome">MEDIDAS EXTERNAS</h2>
                <span class="croqui-contagem">
                  {feitos} de {forma.campos.length}
                </span>
              </div>
              <p class="item-tipo">Croqui do corpo · {forma.formato}</p>
              <span class="selo">Não está no PCM</span>
              <div class="campos">
                {forma.campos.map((c) => (
                  <Campo
                    key={c.letra}
                    campo={c}
                    v={valores[c.letra] ?? {}}
                    mudar={(novo) => setValores({ ...valores, [c.letra]: novo })}
                  />
                ))}
              </div>
              <button type="button" class="botao botao--secundario botao--largo">
                <IconeCamera />
                Tirar foto do equipamento
              </button>
            </li>
          </ol>
          <nav class="fim-guia" aria-label="Seguir">
            <button type="button" class="botao botao--grande botao--proximo">
              <span class="botao-linha">Seguir para {forma.seguir}</span>
            </button>
          </nav>
        </section>
      </main>
    </>
  );
}

const busca = new URLSearchParams(location.search);
if (busca.get('tema') === 'escuro') document.documentElement.dataset.tema = 'escuro';
if (busca.get('tema') === 'claro') document.documentElement.dataset.tema = 'claro';
const forma = FORMAS[busca.get('forma') ?? 'aero'] ?? FORMAS.aero!;
render(<Prototipo forma={forma} />, document.getElementById('app')!);
