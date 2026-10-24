/**
 * Campos de digitação da ficha levam o atributo `data-campo-ficha` (ordem = ordem na tela).
 * Enter / "próximo" do teclado: vai para o próximo campo da ficha; no último, fecha o teclado.
 * (O Chrome do Android às vezes já avança sozinho com enterkeyhint="next"; aí isto nem roda.)
 */
export function irAoProximoCampo(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
  const atual = e.currentTarget;
  if (!(atual instanceof HTMLElement)) return;
  e.preventDefault();
  const campos = [...document.querySelectorAll<HTMLElement>('[data-campo-ficha]')];
  const proximo = campos[campos.indexOf(atual) + 1];
  if (proximo) proximo.focus();
  else atual.blur();
}
