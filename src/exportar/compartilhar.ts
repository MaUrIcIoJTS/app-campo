/**
 * Mandar o arquivo para fora do app.
 *
 * O Chrome do Android só compartilha (Web Share) imagem, áudio, vídeo, PDF e texto, até 50 MB:
 * para .xlsx, .json e .zip, `canShare()` diz que sim mas `share()` falha com NotAllowedError.
 * Por isso o caminho principal é BAIXAR (vai para Downloads, qualquer tamanho, sem internet) e
 * enviar pelo WhatsApp como documento; "Compartilhar" fica para onde funciona (iPhone) e, se
 * o navegador recusar, o arquivo é baixado na hora.
 */

export type ResultadoCompartilhar = 'compartilhado' | 'cancelado' | 'recusado';

export async function compartilhar(arquivo: File): Promise<ResultadoCompartilhar> {
  try {
    if (!navigator.canShare?.({ files: [arquivo] })) return 'recusado';
    await navigator.share({ files: [arquivo], title: arquivo.name });
    return 'compartilhado';
  } catch (e) {
    // Fechar a folha de compartilhamento não é erro.
    return (e as { name?: unknown } | null)?.name === 'AbortError' ? 'cancelado' : 'recusado';
  }
}

/** Baixa o arquivo (mesmo efeito de tocar no link "Baixar"). */
export function baixar(url: string, nome: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

/** "2,4 MB", "830 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
