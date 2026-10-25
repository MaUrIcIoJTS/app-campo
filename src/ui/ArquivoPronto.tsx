import { useEffect, useMemo, useState } from 'preact/hooks';
import { baixar, compartilhar, tamanhoLegivel } from '../exportar/compartilhar.ts';
import { IconeBaixar, IconeCompartilhar } from './Icones.tsx';

/** URL do arquivo para o link "Baixar"; revogada um tempo depois (o download lê o blob depois). */
export function useUrl(arquivo: Blob): string {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo]);
  useEffect(() => () => void setTimeout(() => URL.revokeObjectURL(url), 60_000), [url]);
  return url;
}

/**
 * O Chrome do Android recusa compartilhar .json/.xlsx/.zip (Web Share só aceita imagem, PDF,
 * texto…): lá, "Compartilhar" só baixaria de novo. Mostra apenas "Baixar".
 */
const ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

const hora = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * "Backup de 26/10 14:30" e, embaixo, o tamanho e o nome do arquivo (para achar em Downloads).
 * `pendente`: ainda não foi baixado — "Pronto para baixar" em cima, para não parecer feito.
 */
export function CabecalhoArquivo({
  titulo,
  arquivo,
  pendente = false,
}: {
  titulo: string;
  arquivo: File;
  pendente?: boolean;
}) {
  return (
    <>
      {pendente && <p class="arquivo-pendente">Pronto para baixar</p>}
      <p class="arquivo-titulo">{titulo}</p>
      <p class="arquivo-nome">
        {tamanhoLegivel(arquivo.size)} · <span>{arquivo.name}</span>
      </p>
    </>
  );
}

/**
 * Depois de baixar: onde está e o caminho que funciona para mandar (testado no Android em 25/10:
 * o "clipe → Documento" do WhatsApp não lista .json; pelo app de arquivos, sim).
 */
export function AvisoBaixado({ em, recusado = false }: { em: Date; recusado?: boolean }) {
  return (
    <div class="aviso aviso--bloco aviso--feito" role="status">
      {recusado && <p>Este celular não deixa compartilhar este arquivo direto: ele foi baixado.</p>}
      <p class="aviso-feito-titulo">
        ✓ Baixado às {hora(em)}: está em <strong>Downloads</strong>.
      </p>
      <p>
        Para mandar: app de arquivos do celular → <strong>Downloads</strong> → segure o arquivo →{' '}
        <strong>Compartilhar → WhatsApp</strong>.
      </p>
      <p class="aviso-nota">Deu “Falha no download”? Libere espaço e baixe de novo.</p>
    </div>
  );
}

/** Link "Baixar" (download de verdade: vai para Downloads, qualquer tamanho, sem internet). */
export function LinkBaixar({
  url,
  arquivo,
  classe,
  rotulo,
  onBaixou,
}: {
  url: string;
  arquivo: File;
  classe: string;
  rotulo: string;
  onBaixou: () => void;
}) {
  return (
    <a class={classe} href={url} download={arquivo.name} onClick={onBaixou}>
      <IconeBaixar />
      {rotulo}
    </a>
  );
}

/**
 * Arquivo já gerado: título curto, nome do arquivo, "Baixar" (caminho principal) e, fora do
 * Android, "Compartilhar" (se o navegador recusar o tipo, baixa na hora). O aviso de "Baixado"
 * aparece embaixo do botão: nada muda de lugar sob o dedo.
 */
export function ArquivoPronto({
  arquivo,
  titulo,
  aoEnviar,
}: {
  arquivo: File;
  /** "Backup de 26/10 14:30". */
  titulo: string;
  aoEnviar?: () => void;
}) {
  const url = useUrl(arquivo);
  const [baixadoEm, setBaixadoEm] = useState<Date | null>(null);
  const [recusado, setRecusado] = useState(false);

  function baixou() {
    setBaixadoEm(new Date());
    aoEnviar?.();
  }

  async function tocarCompartilhar() {
    const r = await compartilhar(arquivo);
    if (r === 'cancelado') return;
    if (r === 'recusado') {
      baixar(url, arquivo.name);
      setRecusado(true);
      setBaixadoEm(new Date());
    }
    aoEnviar?.();
  }

  return (
    <div class="arquivo-pronto">
      <CabecalhoArquivo titulo={titulo} arquivo={arquivo} pendente={!baixadoEm} />
      <div class="acoes acoes--pilha">
        <LinkBaixar
          url={url}
          arquivo={arquivo}
          classe={baixadoEm ? 'botao botao--secundario botao--grande' : 'botao botao--grande'}
          rotulo={baixadoEm ? 'Baixar de novo' : 'Baixar'}
          onBaixou={baixou}
        />
        {!ANDROID && (
          <button
            type="button"
            class="botao botao--secundario"
            onClick={() => void tocarCompartilhar()}
          >
            <IconeCompartilhar />
            Compartilhar
          </button>
        )}
      </div>
      {baixadoEm && <AvisoBaixado em={baixadoEm} recusado={recusado} />}
    </div>
  );
}
