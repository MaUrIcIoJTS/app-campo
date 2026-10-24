import { Centro, Cota, Seta, Svg, Texto } from './base.tsx';

/** Tapete visto de cima: fluxo para a direita → LE em cima, LD embaixo. */
export function VistaSuperior() {
  return (
    <Svg viewBox="0 0 300 222" titulo="Tapete visto de cima: centro a centro LD e LE">
      <Centro x1={40} y1={12} x2={40} y2={206} />
      <Centro x1={260} y1={12} x2={260} y2={206} />
      {/* eixos com os mancais nas pontas */}
      <rect class="peca" x={36} y={34} width={8} height={152} />
      <rect class="peca" x={256} y={34} width={8} height={152} />
      <rect class="cheia" x={30} y={34} width={20} height={14} />
      <rect class="cheia" x={30} y={172} width={20} height={14} />
      <rect class="cheia" x={250} y={34} width={20} height={14} />
      <rect class="cheia" x={250} y={172} width={20} height={14} />
      {/* tambores e a correia entre eles */}
      <rect class="cheia" x={28} y={56} width={24} height={108} rx={3} />
      <rect class="cheia" x={248} y={56} width={24} height={108} rx={3} />
      <rect class="cheia" x={40} y={62} width={220} height={96} />
      <Seta x1={96} y1={102} x2={204} y2={102} />
      <Texto x={150} y={90} ancora="meio">
        fluxo do material
      </Texto>
      <Texto x={52} y={146}>
        Retorno
      </Texto>
      <Texto x={248} y={146} ancora="fim">
        Tração
      </Texto>
      {/* LE em cima, LD embaixo (olhando no sentido do fluxo) */}
      <Cota x1={40} y1={26} x2={260} y2={26} texto="Centro a centro LE" ty={19} />
      <Cota x1={40} y1={196} x2={260} y2={196} texto="Centro a centro LD" ty={215} />
    </Svg>
  );
}
