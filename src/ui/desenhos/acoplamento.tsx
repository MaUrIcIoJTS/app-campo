import { Cota, Guia, Svg, Texto } from './base.tsx';

/** Acoplamento de lado: Ø externo e o furo de cada lado (= Ø de cada eixo). */
export function Acoplamento() {
  return (
    <Svg viewBox="0 0 300 192" titulo="Acoplamento: diâmetro externo e furos">
      <rect class="peca" x={10} y={80} width={80} height={18} />
      <rect class="escura" x={58} y={80} width={26} height={4} />
      <rect class="peca" x={210} y={78} width={80} height={22} />
      <rect class="escura" x={216} y={78} width={28} height={5} />
      <rect class="cheia" x={90} y={50} width={55} height={78} rx={4} />
      <rect class="cheia" x={155} y={50} width={55} height={78} rx={4} />
      <rect class="escura" x={145} y={58} width={10} height={62} />
      <Cota x1={196} y1={50} x2={196} y2={128} />
      <Texto x={183} y={40} ancora="meio" destaque>
        Ø externo
      </Texto>
      <Guia x1={50} y1={98} x2={50} y2={150} />
      <Texto x={10} y={166} destaque>
        Furo lado motor
      </Texto>
      <Guia x1={270} y1={100} x2={270} y2={164} />
      <Texto x={292} y={182} ancora="fim" destaque>
        Furo lado movido
      </Texto>
    </Svg>
  );
}
