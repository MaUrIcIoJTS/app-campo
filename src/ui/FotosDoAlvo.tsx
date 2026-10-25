import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Foto } from '../db/esquema.ts';
import { fotosDosAlvos } from '../db/repositorio.ts';
import { emOrdem } from '../dominio/fotos.ts';
import { useDados } from './dados.tsx';
import {
  apagar,
  atualizarEspaco,
  cameraAbrindo,
  cameraCancelada,
  dispensarAviso,
  ouvirFotos,
  receberFotos,
  secaoDe,
  tentarDeNovo,
  textoDaFalha,
  useEstadoFotos,
  type Destino,
} from './fotos.ts';
import { IconeCamera } from './Icones.tsx';

interface FotosNaTela {
  equipamentoId: string;
  /** alvoId → fotos em ordem. Só as do equipamento aberto (com os blobs). */
  porAlvo: ReadonlyMap<string, Foto[]>;
  erroAoLer: boolean;
}

const ContextoFotos = createContext<FotosNaTela>({
  equipamentoId: '',
  porAlvo: new Map(),
  erroAoLer: false,
});

/**
 * Carrega as fotos do equipamento aberto e acompanha as gravadas/apagadas enquanto a ficha
 * está na tela. Use `key` com o id do equipamento (troca de ficha = começa do zero).
 */
export function ProvedorFotos({
  equipamentoId,
  itemIds,
  children,
}: {
  equipamentoId: string;
  itemIds: readonly string[];
  children: ComponentChildren;
}) {
  const [estado, setEstado] = useState<FotosNaTela>({
    equipamentoId,
    porAlvo: new Map(),
    erroAoLer: false,
  });
  const chave = [equipamentoId, ...itemIds].join('\n');

  useEffect(() => {
    const ids = new Set(chave.split('\n'));
    const naTela = new Map<string, Foto>();
    const apagadas = new Set<string>();
    let vivo = true;
    let erroAoLer = false;
    const publicar = () => {
      const porAlvo = new Map<string, Foto[]>();
      for (const f of emOrdem([...naTela.values()]))
        porAlvo.set(f.alvoId, [...(porAlvo.get(f.alvoId) ?? []), f]);
      setEstado({ equipamentoId, porAlvo, erroAoLer });
    };
    const parar = ouvirFotos((m) => {
      if (!ids.has(m.foto.alvoId)) return;
      if (m.tipo === 'gravada') naTela.set(m.foto.id, m.foto);
      else {
        naTela.delete(m.foto.id);
        apagadas.add(m.foto.id);
      }
      publicar();
    });
    fotosDosAlvos([...ids])
      .then((lista) => {
        // Gravadas durante a leitura já entraram pelo ouvinte; apagadas não voltam.
        for (const f of lista) if (!apagadas.has(f.id)) naTela.set(f.id, f);
      })
      .catch((e: unknown) => {
        console.error('Fotos não abriram', e);
        erroAoLer = true;
      })
      .finally(() => vivo && publicar());
    void atualizarEspaco();
    return () => {
      vivo = false;
      parar();
    };
  }, [chave, equipamentoId]);

  return <ContextoFotos.Provider value={estado}>{children}</ContextoFotos.Provider>;
}

/** Uma vez só, no cabeçalho da ficha: as fotos do equipamento não abriram. */
export function ErroAoLerFotos() {
  const { erroAoLer } = useContext(ContextoFotos);
  if (!erroAoLer) return null;
  return (
    <p class="erro" role="alert">
      ⚠ Não consegui abrir as fotos. Feche e abra o app.
    </p>
  );
}

/** URL temporária do blob, revogada quando o componente sai da tela. */
function useUrl(blob: Blob): string {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return url;
}

interface Props {
  alvoId: string;
  /** Nome do item/equipamento, para a foto ampliada. */
  nome: string;
  /** Texto do botão da câmera. */
  rotulo: string;
  /** Bloco em destaque só com as fotos da placa (motor/redutor). */
  placa?: boolean;
  /**
   * Mostra também as fotos da placa (com o selo). Para item sem bloco de placa — ex.: deixou
   * de ser motor numa reimportação —, senão elas sumiriam da tela.
   */
  comPlaca?: boolean;
}

/** Miniaturas + "Tirar foto" e "Galeria" de um item ou do equipamento. */
export function FotosDoAlvo({ alvoId, nome, rotulo, placa = false, comPlaca = false }: Props) {
  const { contarFoto } = useDados();
  const { porAlvo, equipamentoId } = useContext(ContextoFotos);
  const { andamento, falhas } = useEstadoFotos();
  const [aberta, setAberta] = useState<Foto | null>(null);

  const secao = secaoDe(alvoId, placa);
  const destino: Destino = { alvoId, equipamentoId, daPlaca: placa };
  const fotos = (porAlvo.get(alvoId) ?? []).filter(
    (f) => !!f.daPlaca === placa || (comPlaca && !placa),
  );
  const salvando = andamento.get(secao);
  const aSalvar = salvando ? salvando.total - salvando.feitas : 0;
  const falha = falhas.get(secao);
  const n = fotos.length;

  return (
    <section class={placa ? 'fotos fotos--placa' : 'fotos'}>
      {n > 0 && !placa && <p class="fotos-titulo">{n === 1 ? '1 foto' : `${n} fotos`}</p>}
      {n + aSalvar > 0 && (
        <ul class="fotos-grade">
          {fotos.map((f, k) => (
            <li key={f.id}>
              <Miniatura
                foto={f}
                rotulo={placa ? `Ampliar foto da placa ${k + 1}` : `Ampliar foto ${k + 1} de ${n}`}
                onAbrir={() => setAberta(f)}
              />
            </li>
          ))}
          {Array.from({ length: aSalvar }, (_, k) => (
            <li key={`salvando-${k}`}>
              <span class="miniatura miniatura--salvando" role="status">
                Salvando…
              </span>
            </li>
          ))}
        </ul>
      )}
      {falha && (
        <div class="aviso aviso--bloco fotos-aviso" role="alert">
          <p>⚠ {textoDaFalha(falha)}</p>
          <div class="fotos-aviso-acoes">
            {falha.refazer.length > 0 && (
              <button
                type="button"
                class="botao"
                onClick={() => void tentarDeNovo(secao, contarFoto)}
              >
                Tentar de novo ({falha.refazer.length})
              </button>
            )}
            <button
              type="button"
              class="botao botao--secundario"
              onClick={() => dispensarAviso(secao)}
            >
              {falha.refazer.length > 0 ? 'Descartar' : 'Entendi'}
            </button>
          </div>
        </div>
      )}
      <div class="fotos-acoes">
        <BotaoFoto
          secao={secao}
          equipamentoId={equipamentoId}
          camera
          classe={placa ? 'botao botao--grande' : 'botao botao--secundario fotos-tirar'}
          onArquivos={(arquivos, abertura) =>
            void receberFotos(destino, arquivos, abertura, contarFoto)
          }
        >
          <IconeCamera />
          {rotulo}
        </BotaoFoto>
        <BotaoFoto
          secao={secao}
          equipamentoId={equipamentoId}
          classe="botao botao--secundario fotos-galeria"
          onArquivos={(arquivos, abertura) =>
            void receberFotos(destino, arquivos, abertura, contarFoto)
          }
        >
          Galeria
        </BotaoFoto>
      </div>
      {aberta && (
        <FotoAmpliada
          foto={aberta}
          titulo={aberta.daPlaca ? `${nome} · placa` : nome}
          onFechar={() => setAberta(null)}
          onApagar={() => apagar(aberta, contarFoto)}
        />
      )}
    </section>
  );
}

/**
 * Câmera e galeria SEMPRE por <label> + <input type="file">: nunca .click() programático.
 * Ao tocar, anota que uma foto vai chegar (o Android pode matar a página com a câmera
 * aberta); a anotação fica no próprio input até a foto chegar ou o técnico cancelar.
 */
function BotaoFoto({
  secao,
  equipamentoId,
  camera = false,
  classe,
  children,
  onArquivos,
}: {
  secao: string;
  equipamentoId: string;
  /** Abre direto a câmera traseira; sem isto, a galeria (várias fotos de uma vez). */
  camera?: boolean;
  classe: string;
  children: ComponentChildren;
  onArquivos: (arquivos: File[], abertura: string | undefined) => void;
}) {
  return (
    <label class={classe}>
      <input
        type="file"
        accept="image/*"
        class="oculto"
        capture={camera ? 'environment' : undefined}
        multiple={!camera}
        onClick={(e) => {
          const input = e.currentTarget;
          // Anotação anterior ainda aberta = a câmera voltou sem foto e sem avisar.
          cameraCancelada(input.dataset.abertura);
          input.dataset.abertura = cameraAbrindo(secao, equipamentoId);
        }}
        onCancel={(e) => {
          cameraCancelada(e.currentTarget.dataset.abertura);
          delete e.currentTarget.dataset.abertura;
        }}
        onChange={(e) => {
          const input = e.currentTarget;
          const arquivos = [...(input.files ?? [])];
          const abertura = input.dataset.abertura;
          delete input.dataset.abertura;
          input.value = ''; // permite escolher a mesma foto de novo
          if (arquivos.length > 0) onArquivos(arquivos, abertura);
          else cameraCancelada(abertura);
        }}
      />
      {children}
    </label>
  );
}

function Miniatura({ foto, rotulo, onAbrir }: { foto: Foto; rotulo: string; onAbrir: () => void }) {
  const url = useUrl(foto.miniatura ?? foto.blob); // foto antiga, sem miniatura: usa a grande
  return (
    <button type="button" class="miniatura" aria-label={rotulo} onClick={onAbrir}>
      <img src={url} alt="" decoding="async" loading="lazy" />
      {foto.daPlaca && <span class="miniatura-selo">Placa</span>}
    </button>
  );
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Fração (0–1) do ponto tocado dentro da imagem desenhada com object-fit: contain. */
function pontoNaImagem(e: MouseEvent, img: HTMLImageElement): { x: number; y: number } {
  const caixa = img.getBoundingClientRect();
  const escala = Math.min(caixa.width / img.naturalWidth, caixa.height / img.naturalHeight) || 1;
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;
  const limitar = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x: limitar((e.clientX - caixa.left - (caixa.width - w) / 2) / w),
    y: limitar((e.clientY - caixa.top - (caixa.height - h) / 2) / h),
  };
}

/**
 * Foto em tela cheia. Tocar na foto amplia ali (e rola com um dedo, sem pinça); tocar de novo
 * mostra inteira. "Apagar" (em cima) pede confirmação embaixo; nenhum toque repetido no
 * mesmo lugar — nem no "Apagar", nem no "Fechar" — cai no "Sim, apagar".
 */
function FotoAmpliada({
  foto,
  titulo,
  onFechar,
  onApagar,
}: {
  foto: Foto;
  titulo: string;
  onFechar: () => void;
  onApagar: () => Promise<void>;
}) {
  const dialogoRef = useRef<HTMLDialogElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const url = useUrl(foto.blob);
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const aoFecharRef = useRef(onFechar);
  useEffect(() => {
    aoFecharRef.current = onFechar;
  }, [onFechar]);

  useEffect(() => {
    const d = dialogoRef.current;
    if (!d) return;
    d.showModal(); // o "voltar" do Android fecha o diálogo (evento close)
    const fechou = () => aoFecharRef.current();
    d.addEventListener('close', fechou);
    return () => {
      d.removeEventListener('close', fechou);
      if (d.open) d.close();
    };
  }, []);

  // Ampliou: centraliza no ponto tocado.
  useLayoutEffect(() => {
    const a = areaRef.current;
    if (!a || !zoom) return;
    a.scrollLeft = zoom.x * a.scrollWidth - a.clientWidth / 2;
    a.scrollTop = zoom.y * a.scrollHeight - a.clientHeight / 2;
  }, [zoom]);

  async function confirmar() {
    setApagando(true);
    setErro(null);
    try {
      await onApagar();
      dialogoRef.current?.close();
    } catch (e) {
      console.error('Foto não apagada', e);
      setErro('Não consegui apagar. Tente de novo.');
      setApagando(false);
    }
  }

  return (
    <dialog ref={dialogoRef} class="foto-dialogo" aria-label={`Foto: ${titulo}`}>
      <div class="foto-dialogo-topo">
        <p class="foto-dialogo-titulo">
          {titulo}
          <span class="foto-dialogo-data">{dataHora(foto.criadaEm)}</span>
        </p>
        {/* Apagar fica em cima, longe do "Fechar" e do "Ampliar" (embaixo). */}
        <button
          type="button"
          class="botao botao--secundario botao--perigo-contorno"
          onClick={() => setConfirmando(true)}
        >
          Apagar
        </button>
      </div>
      <div ref={areaRef} class={zoom ? 'foto-area foto-area--zoom' : 'foto-area'}>
        <img
          class="foto-grande"
          src={url}
          alt={`Foto: ${titulo}`}
          onClick={(e) => setZoom(zoom ? null : pontoNaImagem(e, e.currentTarget))}
        />
      </div>
      {confirmando ? (
        // "Não, manter" na largura toda, no lugar dos botões de baixo: tocar onde estava o
        // "Fechar" (ou o "Ampliar") nunca apaga.
        <div class="foto-dialogo-acoes foto-confirmar" role="group" aria-label="Confirmar">
          <p>Apagar esta foto? Não dá para desfazer.</p>
          {erro && (
            <p class="erro" role="alert">
              ⚠ {erro}
            </p>
          )}
          <button
            type="button"
            class="botao botao--perigo"
            disabled={apagando}
            onClick={() => void confirmar()}
          >
            {apagando ? 'Apagando…' : 'Sim, apagar'}
          </button>
          <button
            type="button"
            class="botao botao--secundario foto-manter"
            disabled={apagando}
            onClick={() => setConfirmando(false)}
          >
            Não, manter
          </button>
        </div>
      ) : (
        <div class="foto-dialogo-acoes">
          <button
            type="button"
            class="botao botao--secundario"
            onClick={() => setZoom(zoom ? null : { x: 0.5, y: 0.5 })}
          >
            {zoom ? 'Ver inteira' : 'Ampliar'}
          </button>
          <button type="button" class="botao" autoFocus onClick={() => dialogoRef.current?.close()}>
            Fechar
          </button>
        </div>
      )}
    </dialog>
  );
}
