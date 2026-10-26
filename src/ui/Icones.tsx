/**
 * Ícones em SVG no desenho do Material (traço de 2 px, pontas arredondadas, grade de 24). Emoji
 * e símbolos Unicode dependem da fonte do celular e podem virar um quadrado; estes desenham igual
 * em qualquer aparelho. Sempre ao lado de um texto ou com rótulo no botão (aria-hidden).
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

/** Várias fotos empilhadas: escolher da galeria. */
export function IconeGaleria() {
  return (
    <Icone>
      <rect x="7" y="3" width="14" height="14" rx="2" />
      <path d="M3 7v11a3 3 0 0 0 3 3h11" />
      <path d="M9.5 14l3-3.4 2.3 2.5 1.4-1.4 2.3 2.3" />
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

/** Folha com seta para cima: escolher a planilha do PCM. */
export function IconeArquivo() {
  return (
    <Icone>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 17.5v-6M9.5 14l2.5-2.5 2.5 2.5" />
    </Icone>
  );
}

export function IconeVoltar() {
  return (
    <Icone>
      <path d="M20 12H4.5M11 5l-7 7 7 7" />
    </Icone>
  );
}

export function IconeAvancar() {
  return (
    <Icone>
      <path d="M9 5.5l6.5 6.5L9 18.5" />
    </Icone>
  );
}

export function IconeExpandir() {
  return (
    <Icone>
      <path d="M6 9.5l6 6 6-6" />
    </Icone>
  );
}

export function IconeSetaBaixo() {
  return (
    <Icone>
      <path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5" />
    </Icone>
  );
}

export function IconeConfere() {
  return (
    <Icone>
      <path d="M4.5 12.5l5 5L19.5 7" />
    </Icone>
  );
}

export function IconeDiverge() {
  return (
    <Icone>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icone>
  );
}

/** Círculo com visto: salvo, feito. */
export function IconeFeito() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.6" />
    </Icone>
  );
}

/** Triângulo de atenção. */
export function IconeAviso() {
  return (
    <Icone>
      <path d="M10.3 4.4a2 2 0 0 1 3.4 0l7.6 13.1a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z" />
      <path d="M12 9.5V14M12 17.2v.1" />
    </Icone>
  );
}

/** Círculo com exclamação: algo não deu certo. */
export function IconeErro() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.4v.1" />
    </Icone>
  );
}

/** Duas setas girando: gravando. */
export function IconeSalvando() {
  return (
    <Icone>
      <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9" />
      <path d="M19.5 4.5V9H15" />
      <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15" />
      <path d="M4.5 19.5V15H9" />
    </Icone>
  );
}

export function IconeBuscar() {
  return (
    <Icone>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </Icone>
  );
}

/** Régua: desenho "onde medir". */
export function IconeRegua() {
  return (
    <Icone>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M6.5 8v3M10 8v4.5M13.5 8v3M17 8v4.5" />
    </Icone>
  );
}

export function IconeApagar() {
  return (
    <Icone>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </Icone>
  );
}

/** Meio círculo cheio: tema claro/escuro. */
export function IconeTema() {
  return (
    <Icone>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </Icone>
  );
}

/** Celular com escudo: dados guardados no aparelho. */
export function IconeAparelho() {
  return (
    <Icone>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </Icone>
  );
}
