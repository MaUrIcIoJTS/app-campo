import { Cota, Linha, Svg, Texto } from './base.tsx';

/** Caneca de elevador: de frente (L) e de lado (A, P), como no PCM "A×L×P". */
export function Caneca() {
  return (
    <Svg viewBox="0 0 300 176" titulo="Caneca: altura A, largura L e profundidade P">
      <Texto x={89} y={30} ancora="meio">
        De frente
      </Texto>
      <rect class="cheia" x={24} y={48} width={130} height={76} rx={6} />
      <Linha x1={24} y1={128} x2={24} y2={152} />
      <Linha x1={154} y1={128} x2={154} y2={152} />
      <Cota x1={24} y1={146} x2={154} y2={146} texto="L" ty={168} />
      <Texto x={232} y={30} ancora="meio">
        De lado
      </Texto>
      {/* correia atrás, perfil da caneca na frente */}
      <line class="escura-linha" x1={272} y1={36} x2={272} y2={136} />
      <path class="cheia" d="M268,48 L268,124 Q260,130 232,126 Q198,120 190,52 Z" />
      <Linha x1={190} y1={56} x2={190} y2={152} />
      <Linha x1={268} y1={128} x2={268} y2={152} />
      <Cota x1={190} y1={146} x2={268} y2={146} texto="P" ty={168} />
      <Linha x1={270} y1={48} x2={292} y2={48} />
      <Linha x1={270} y1={124} x2={292} y2={124} />
      <Cota x1={284} y1={48} x2={284} y2={124} />
      <Texto x={292} y={42} ancora="fim" destaque>
        A
      </Texto>
    </Svg>
  );
}
