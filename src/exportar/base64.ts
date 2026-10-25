/** Blob ↔ base64 sem montar nada grande na memória (uma foto por vez). */

/** Base64 do conteúdo do blob. No navegador, o FileReader faz a conversão em código nativo. */
export async function blobParaBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    const url = await new Promise<string>((ok, erro) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = () => erro(leitor.error ?? new Error('Falha ao ler o arquivo'));
      leitor.readAsDataURL(blob);
    });
    return url.slice(url.indexOf(',') + 1);
  }
  // Node (testes): em pedaços, para não estourar o limite de argumentos.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

type ComFromBase64 = { fromBase64?: (s: string) => Uint8Array };

/** Bytes a partir de base64. Lança erro se o texto não for base64 válido. */
export function base64ParaBytes(base64: string): Uint8Array {
  const nativo = (Uint8Array as unknown as ComFromBase64).fromBase64;
  if (nativo) return nativo(base64);
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
