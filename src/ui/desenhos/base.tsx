/**
 * Peças dos desenhos de referência ("onde medir"). SVG inline: contorno em `currentColor`
 * (funciona nos dois temas), o que se mede em destaque (cor primária), texto ≥ 14 px na tela
 * de 360 px (viewBox de 300 de largura ≈ escala 1). Setas desenhadas — `<marker>` não aparece
 * quando o SVG nasce dentro de um `<details>` fechado.
 */
import type { ComponentChildren } from 'preact';

const r = (n: number) => Math.round(n * 10) / 10;

/** Triângulo da seta com a ponta em (x, y), apontando no ângulo `ang`. */
function ponta(x: number, y: number, ang: number, tamanho: number): string {
  const canto = (a: number) => `${r(x + tamanho * Math.cos(a))},${r(y + tamanho * Math.sin(a))}`;
  return `${r(x)},${r(y)} ${canto(ang + Math.PI - 0.42)} ${canto(ang + Math.PI + 0.42)}`;
}

type Ancora = 'inicio' | 'meio' | 'fim';
const classeAncora = (a: Ancora) => (a === 'inicio' ? undefined : a);

export function Svg({
  viewBox,
  titulo,
  children,
}: {
  viewBox: string;
  titulo: string;
  children: ComponentChildren;
}) {
  return (
    <svg class="desenho-svg" viewBox={viewBox} role="img" aria-label={titulo}>
      {children}
    </svg>
  );
}

interface CotaProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Letra ou nome igual ao do campo da ficha. */
  texto?: string;
  tx?: number;
  ty?: number;
  ancora?: Ancora;
  /** Tamanho das setas (menor em cotas curtas). */
  seta?: number;
  /** Medida curta demais para setas por dentro: setas por fora, apontando para a peça. */
  externa?: boolean;
}

/** Cota: o que se mede, com seta nas duas pontas, em destaque. */
export function Cota(props: CotaProps) {
  const { x1, y1, x2, y2, texto, tx, ty, ancora = 'meio', seta = 8, externa = false } = props;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const [dx, dy] = [Math.cos(ang) * 18, Math.sin(ang) * 18];
  return (
    <g class="cota">
      {externa ? (
        <>
          <line x1={r(x1 - dx)} y1={r(y1 - dy)} x2={x1} y2={y1} />
          <polygon points={ponta(x1, y1, ang, seta)} />
          <line x1={r(x2 + dx)} y1={r(y2 + dy)} x2={x2} y2={y2} />
          <polygon points={ponta(x2, y2, ang + Math.PI, seta)} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} />
          <polygon points={ponta(x2, y2, ang, seta)} />
          <polygon points={ponta(x1, y1, ang + Math.PI, seta)} />
        </>
      )}
      {texto && (
        <text x={tx ?? (x1 + x2) / 2} y={ty ?? (y1 + y2) / 2 - 7} class={classeAncora(ancora)}>
          {texto}
        </text>
      )}
    </g>
  );
}

/** Seta de um lado só (sentido do fluxo, giro). */
export function Seta({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g class="seta">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={ponta(x2, y2, Math.atan2(y2 - y1, x2 - x1), 11)} />
    </g>
  );
}

/** Linha fina: chamada de cota (extensão) ou linha de chamada até o rótulo (guia). */
export function Linha({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line class="extensao" x1={x1} y1={y1} x2={x2} y2={y2} />;
}

/** Linha de chamada com bolinha no ponto indicado (x1, y1). */
export function Guia({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <g class="guia">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <circle cx={x1} cy={y1} r={3.5} />
    </g>
  );
}

export function Texto({
  x,
  y,
  children,
  ancora = 'inicio',
  destaque = false,
}: {
  x: number;
  y: number;
  children: ComponentChildren;
  ancora?: Ancora;
  destaque?: boolean;
}) {
  const classes = [classeAncora(ancora), destaque && 'destaque'].filter(Boolean).join(' ');
  return (
    <text x={x} y={y} class={classes || undefined}>
      {children}
    </text>
  );
}

/** Número em círculo (legenda abaixo do desenho explica cada um). */
export function Marca({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g class="marca">
      <circle cx={x} cy={y} r={11} />
      <text x={x} y={y + 5} class="meio">
        {n}
      </text>
    </g>
  );
}

/** Linha de centro (traço-ponto). */
export function Centro({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line class="centro" x1={x1} y1={y1} x2={x2} y2={y2} />;
}
