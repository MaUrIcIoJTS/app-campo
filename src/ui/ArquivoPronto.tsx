import { useEffect, useMemo, useState } from 'preact/hooks';
import { baixar, compartilhar, tamanhoLegivel } from '../exportar/compartilhar.ts';

/** URL do arquivo para o link "Baixar"; revogada um tempo depois (o download lê o blob depois). */
function useUrl(arquivo: Blob): string {
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
 * Arquivo já gerado: "Baixar" (link de verdade, caminho principal) e, fora do Android,
 * "Compartilhar" (se o navegador recusar o tipo, baixa na hora). Depois de baixar, a tela diz
 * onde o arquivo está e como mandar pelo WhatsApp. Testado no Android (25/10): o "clipe →
 * Documento" do WhatsApp não lista .json; o caminho que funciona é sair pelo app de arquivos.
 */
export function ArquivoPronto({ arquivo, aoEnviar }: { arquivo: File; aoEnviar?: () => void }) {
  const url = useUrl(arquivo);
  const [baixadoEm, setBaixadoEm] = useState<Date | null>(null);
  const [recusado, setRecusado] = useState(false);
  const tamanho = tamanhoLegivel(arquivo.size);

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
      <p class="arquivo-nome">
        <strong>{arquivo.name}</strong> · {tamanho}
      </p>
      {baixadoEm && (
        <div class="aviso aviso--bloco aviso--feito" role="status">
          {recusado && (
            <p>
              Este celular não deixa compartilhar este tipo de arquivo direto, então ele foi
              baixado.
            </p>
          )}
          <p>
            ✓ Baixado às {hora(baixadoEm)} ({tamanho}): está em <strong>Downloads</strong>.
          </p>
          <p>
            Para mandar: abra o app de arquivos do celular (Arquivos, Meus Arquivos) →{' '}
            <strong>Downloads</strong> → segure “{arquivo.name}” →{' '}
            <strong>Compartilhar → WhatsApp</strong>.
          </p>
          <p class="aviso-nota">
            Se o Chrome avisar “Falha no download”, libere espaço no celular e baixe de novo.
          </p>
        </div>
      )}
      <div class="acoes acoes--pilha">
        <a
          class={baixadoEm ? 'botao botao--secundario botao--grande' : 'botao botao--grande'}
          href={url}
          download={arquivo.name}
          onClick={baixou}
        >
          {baixadoEm ? 'Baixar de novo' : 'Baixar'}
        </a>
        {!ANDROID && (
          <button
            type="button"
            class="botao botao--secundario"
            onClick={() => void tocarCompartilhar()}
          >
            Compartilhar
          </button>
        )}
      </div>
      {!baixadoEm && (
        <p class="suave">
          Depois de baixar, mande pelo app de arquivos do celular: Downloads → segure o arquivo →
          Compartilhar → WhatsApp.
        </p>
      )}
    </div>
  );
}
