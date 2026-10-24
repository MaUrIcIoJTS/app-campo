import { Centro, Cota, Guia, Svg, Texto } from './base.tsx';

/** Mancal bipartido de pedestal, de frente: tampa com o código gravado e o Ø do eixo. */
export function Mancal() {
  return (
    <Svg viewBox="0 0 300 186" titulo="Mancal de pedestal: código gravado e diâmetro do eixo">
      <rect class="cheia" x={24} y={152} width={252} height={20} rx={3} />
      <rect class="peca" x={44} y={156} width={14} height={12} rx={2} />
      <rect class="peca" x={242} y={156} width={14} height={12} rx={2} />
      <rect class="cheia" x={80} y={104} width={140} height={48} />
      <path class="cheia" d="M80,104 A70,62 0 0 1 220,104 Z" />
      <rect class="peca" x={86} y={90} width={12} height={14} />
      <rect class="peca" x={202} y={90} width={12} height={14} />
      <circle class="furo" cx={150} cy={104} r={30} />
      <circle class="cheia" cx={150} cy={104} r={24} />
      <Centro x1={112} y1={104} x2={188} y2={104} />
      <Centro x1={150} y1={68} x2={150} y2={140} />
      <Cota x1={126} y1={104} x2={174} y2={104} texto="Ø eixo" ty={97} />
      <Guia x1={192} y1={70} x2={226} y2={38} />
      <Texto x={296} y={30} ancora="fim" destaque>
        Código na tampa
      </Texto>
    </Svg>
  );
}
