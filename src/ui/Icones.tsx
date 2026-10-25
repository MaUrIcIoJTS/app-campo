/**
 * Ícones em SVG (traço na cor do texto). Emoji depende da fonte do celular e pode virar um
 * quadrado; estes desenham igual em qualquer aparelho. Sempre ao lado de um texto (aria-hidden).
 */
import type { ComponentChildren } from 'preact';

function Icone({ children }: { children: ComponentChildren }) {
  return (
    <svg class="icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function IconeCamera() {
  return (
    <Icone>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.7l1.8-2.6h6l1.8 2.6h2.7A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
      <circle cx="12" cy="13.2" r="3.8" />
    </Icone>
  );
}

/** Seta para baixo entrando na bandeja. */
export function IconeBaixar() {
  return (
    <Icone>
      <path d="M12 3.5v11.5M7 10l5 5 5-5" />
      <path d="M4 16.5V20h16v-3.5" />
    </Icone>
  );
}

export function IconeCompartilhar() {
  return (
    <Icone>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </Icone>
  );
}

/** Caixa de arquivo: o backup guarda tudo. */
export function IconeBackup() {
  return (
    <Icone>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M9.5 13h5" />
    </Icone>
  );
}

export function IconePlanilha() {
  return (
    <Icone>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9.3h18M3 14.7h18M9 4v16" />
    </Icone>
  );
}

/** Seta girando para trás: voltar dados de um backup. */
export function IconeRestaurar() {
  return (
    <Icone>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 3.8v4.7h4.7" />
    </Icone>
  );
}
