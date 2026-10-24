import { Centro, Guia, Marca, Svg, Texto } from './base.tsx';

/**
 * Acionamento visto de cima, no arranjo mais comum da planta: motor ao lado → polias
 * alinhadas e correias → redutor (coroa e rosca sem fim) com eixo vazado montado no eixo do
 * tambor de tração. A correia liga eixos PARALELOS: o do motor e o de entrada do redutor.
 */
export function Acionamento() {
  return (
    <Svg viewBox="0 0 300 214" titulo="Acionamento: motor, polias e correias, redutor e tambor">
      {/* tambor de tração (de cima), mancais e o eixo dele entrando no redutor */}
      <Centro x1={257} y1={2} x2={257} y2={150} />
      <rect class="peca" x={253} y={4} width={8} height={142} />
      <rect class="cheia" x={232} y={24} width={50} height={70} rx={4} />
      <rect class="cheia" x={247} y={6} width={20} height={12} />
      <rect class="cheia" x={247} y={100} width={20} height={12} />
      <rect class="cheia" x={220} y={120} width={74} height={66} rx={6} />
      <rect class="peca" x={253} y={120} width={8} height={26} />
      <Guia x1={238} y1={40} x2={222} y2={20} />
      <Texto x={218} y={16} ancora="fim">
        Tambor de tração
      </Texto>
      <Texto x={257} y={176} ancora="meio">
        Redutor
      </Texto>
      {/* entrada do redutor com a polia movida (grande) */}
      <rect class="peca" x={120} y={158} width={100} height={8} />
      <rect class="cheia" x={110} y={134} width={10} height={56} />
      {/* motor ao lado, eixo paralelo, polia motora (pequena) alinhada com a movida */}
      <rect class="peca" x={120} y={58} width={14} height={8} />
      <rect class="cheia" x={110} y={50} width={10} height={24} />
      <rect class="cheia" x={134} y={34} width={62} height={56} rx={6} />
      <Texto x={165} y={67} ancora="meio">
        Motor
      </Texto>
      {/* correias entre as polias (de cima, as duas passadas se sobrepõem) */}
      <rect class="escura" x={111} y={74} width={8} height={60} />
      <Texto x={104} y={100} ancora="fim">
        Polias e
      </Texto>
      <Texto x={104} y={118} ancora="fim">
        correias
      </Texto>
      <Guia x1={127} y1={66} x2={140} y2={100} />
      <Marca x={146} y={110} n={1} />
      <Guia x1={170} y1={166} x2={170} y2={184} />
      <Marca x={170} y={198} n={2} />
      <Guia x1={253} y1={130} x2={222} y2={112} />
      <Marca x={212} y={106} n={3} />
    </Svg>
  );
}
