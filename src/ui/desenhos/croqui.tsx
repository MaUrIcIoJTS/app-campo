/**
 * Croquis das medidas externas: o corpo do equipamento com as cotas por letra. A letra mostra o
 * estado da cota (vazia = falta, cheia = medida, cinza = sem acesso / não tem) e, tocada, leva
 * ao campo da ficha.
 */
import type { EstadoCota } from '../../dominio/croqui.ts';
import type { TipoItem } from '../../dominio/tipos.ts';
import { Centro, Cota, Linha, Svg, Texto } from './base.tsx';

type P = readonly [number, number];

export interface PropsCroqui {
  /** Estado de cada letra (A, B, C…). */
  estados: Readonly<Record<string, EstadoCota>>;
  onToque?: (letra: string) => void;
}

/** Letra da cota em círculo. Área de toque r = 24 (≈ 48 px na tela de 360 px). */
function Letra({
  p,
  letra,
  estado,
  onToque,
}: {
  p: P;
  letra: string;
  estado: EstadoCota;
  onToque?: (letra: string) => void;
}) {
  const nome = { falta: 'falta medir', medida: 'medida', cinza: 'sem medida' }[estado];
  return (
    <g
      class={`letra letra--${estado}`}
      role="button"
      tabIndex={-1}
      aria-label={`Cota ${letra}: ${nome}`}
      onClick={() => onToque?.(letra)}
    >
      <circle class="letra-toque" cx={p[0]} cy={p[1]} r={24} />
      <circle class="letra-fundo" cx={p[0]} cy={p[1]} r={13} />
      <text x={p[0]} y={p[1] + 5} class="meio">
        {letra}
      </text>
    </g>
  );
}

const letraDe =
  ({ estados, onToque }: PropsCroqui) =>
  (letra: string, p: P) => (
    <Letra p={p} letra={letra} estado={estados[letra] ?? 'falta'} onToque={onToque} />
  );

/**
 * Cilindro + cone, de frente. Aeroseparador: acionamento e alimentação em cima, finos embaixo
 * do cone e o retorno de grossos de lado. Silo: boca de carga em cima e uma saída embaixo.
 */
function CilindroCone({ aero, ...props }: PropsCroqui & { aero: boolean }) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 336" titulo={aero ? 'Aeroseparador: cotas A a F' : 'Silo: cotas A a E'}>
      <Centro x1={150} y1={36} x2={150} y2={306} />
      {aero ? (
        <>
          {/* acionamento (motor, polia) e a calha de alimentação em cima */}
          <rect class="cheia" x={120} y={44} width={40} height={31} />
          <Texto x={114} y={64} ancora="fim">
            acionamento
          </Texto>
          <rect class="cheia" x={182} y={50} width={32} height={25} />
          <Linha x1={182} y1={47} x2={182} y2={28} />
          <Linha x1={214} y1={47} x2={214} y2={28} />
          <Cota x1={182} y1={36} x2={214} y2={36} seta={6} />
          {letra('F', [236, 36])}
          {/* retorno de grossos: bica de lado, no cone */}
          <rect class="cheia" x={192} y={236} width={52} height={16} />
          <Texto x={226} y={274}>
            grossos
          </Texto>
          <Linha x1={247} y1={236} x2={268} y2={236} />
          <Linha x1={247} y1={252} x2={268} y2={252} />
          <Cota x1={258} y1={236} x2={258} y2={252} seta={6} externa />
          {letra('E', [280, 244])}
        </>
      ) : (
        <>
          {/* boca de carga em cima */}
          <rect class="cheia" x={176} y={44} width={20} height={31} />
          <Texto x={170} y={64} ancora="fim">
            carga
          </Texto>
          <Linha x1={176} y1={41} x2={176} y2={22} />
          <Linha x1={196} y1={41} x2={196} y2={22} />
          <Cota x1={176} y1={30} x2={196} y2={30} seta={6} externa />
          {letra('E', [226, 30])}
        </>
      )}
      <rect class="cheia principal" x={80} y={75} width={140} height={125} />
      <polygon class="cheia principal" points="80,200 220,200 170,285 130,285" />
      <rect class="cheia" x={133} y={285} width={34} height={15} />
      <Texto x={124} y={300} ancora="fim">
        {aero ? 'finos' : 'saída'}
      </Texto>

      {/* trena em volta: o perímetro dá o Ø */}
      <ellipse class="escondida" cx={150} cy={172} rx={70} ry={9} fill="none" />
      <Texto x={150} y={194} ancora="meio">
        perímetro
      </Texto>
      <Cota x1={80} y1={145} x2={220} y2={145} />
      {letra('A', [150, 145])}

      <Linha x1={77} y1={75} x2={46} y2={75} />
      <Linha x1={77} y1={200} x2={46} y2={200} />
      <Linha x1={127} y1={285} x2={46} y2={285} />
      <Cota x1={56} y1={75} x2={56} y2={200} />
      {letra('B', [56, 137])}
      <Cota x1={56} y1={200} x2={56} y2={285} />
      {letra('C', [56, 242])}

      <Linha x1={133} y1={303} x2={133} y2={324} />
      <Linha x1={167} y1={303} x2={167} y2={324} />
      <Cota x1={133} y1={316} x2={167} y2={316} seta={7} />
      {letra('D', [190, 316])}
    </Svg>
  );
}

/** Croqui de cada tipo de item "corpo-…" (null nos outros tipos). */
export function Croqui({ tipo, ...props }: PropsCroqui & { tipo: TipoItem }) {
  switch (tipo) {
    case 'corpo-aeroseparador':
      return <CilindroCone aero {...props} />;
    case 'corpo-silo':
      return <CilindroCone aero={false} {...props} />;
    default:
      return null;
  }
}

export const LEGENDA_DO_CROQUI =
  'Toque numa letra para ir ao campo.\nCheia: medida. Vazia: falta. Cinza: sem acesso ou não tem.';
