import { Cota, Guia, Linha, Svg, Texto } from './base.tsx';

/** Motor de lado: placa (cv, rpm, V, A, carcaça), ponta de eixo e chaveta. */
export function Motor() {
  return (
    <Svg viewBox="0 0 300 200" titulo="Motor: placa, ponta do eixo e chaveta">
      <rect class="peca" x={6} y={58} width={20} height={74} rx={6} />
      <rect class="cheia" x={26} y={50} width={120} height={90} rx={8} />
      <rect class="peca" x={66} y={28} width={46} height={22} rx={3} />
      <rect class="cheia" x={40} y={140} width={30} height={12} />
      <rect class="cheia" x={104} y={140} width={30} height={12} />
      <rect class="peca" x={146} y={62} width={12} height={66} />
      <rect class="peca" x={158} y={86} width={52} height={18} />
      <rect class="escura" x={172} y={86} width={24} height={5} />
      {/* placa de identificação */}
      <rect class="placa" x={50} y={80} width={66} height={42} rx={3} />
      <line class="peca" x1={58} y1={92} x2={108} y2={92} />
      <line class="peca" x1={58} y1={102} x2={100} y2={102} />
      <line class="peca" x1={58} y1={112} x2={104} y2={112} />
      <Guia x1={83} y1={122} x2={83} y2={172} />
      <Texto x={10} y={190} destaque>
        Placa: cv · rpm · V · A · carcaça
      </Texto>
      <Guia x1={184} y1={86} x2={184} y2={64} />
      <Texto x={184} y={56} ancora="meio" destaque>
        Chaveta
      </Texto>
      <Cota x1={220} y1={86} x2={220} y2={104} seta={7} externa />
      <Linha x1={212} y1={86} x2={226} y2={86} />
      <Linha x1={212} y1={104} x2={226} y2={104} />
      <Texto x={230} y={100} destaque>
        Ø ponta
      </Texto>
    </Svg>
  );
}
