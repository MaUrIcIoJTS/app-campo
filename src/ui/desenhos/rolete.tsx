import { Centro, Cota, Linha, Svg, Texto } from './base.tsx';

/** Rolete de lado (A, B, C) e a ponta do eixo de frente (D fresado, E Ø do eixo). */
export function Rolete() {
  return (
    <Svg viewBox="0 0 300 262" titulo="Rolete: medidas A, B, C, D e E">
      <Centro x1={20} y1={80} x2={280} y2={80} />
      <rect class="peca" x={30} y={72} width={40} height={16} />
      <rect class="peca" x={230} y={72} width={40} height={16} />
      {/* onde começa o fresado */}
      <line class="peca" x1={44} y1={72} x2={44} y2={88} />
      <line class="peca" x1={256} y1={72} x2={256} y2={88} />
      <rect class="cheia" x={70} y={50} width={160} height={60} rx={4} />
      <Linha x1={70} y1={46} x2={70} y2={24} />
      <Linha x1={230} y1={46} x2={230} y2={24} />
      <Cota x1={70} y1={30} x2={230} y2={30} texto="A" ty={23} />
      <Cota x1={100} y1={50} x2={100} y2={110} texto="C" tx={110} ty={74} ancora="inicio" />
      <Linha x1={30} y1={92} x2={30} y2={146} />
      <Linha x1={270} y1={92} x2={270} y2={146} />
      <Cota x1={30} y1={140} x2={270} y2={140} texto="B" ty={159} />
      {/* ponta do eixo vista de frente: círculo com duas faces planas */}
      <Texto x={16} y={210}>
        Ponta do eixo
      </Texto>
      <Texto x={16} y={230}>
        (de frente)
      </Texto>
      <path
        class="cheia"
        d="M181,196.8 A30,30 0 0 1 219,196.8 L219,243.2 A30,30 0 0 1 181,243.2 Z"
      />
      <Centro x1={200} y1={184} x2={200} y2={256} />
      <Centro x1={166} y1={220} x2={234} y2={220} />
      <Linha x1={181} y1={193} x2={181} y2={172} />
      <Linha x1={219} y1={193} x2={219} y2={172} />
      <Cota x1={181} y1={178} x2={219} y2={178} texto="D" ty={171} seta={7} />
      <Linha x1={204} y1={190} x2={262} y2={190} />
      <Linha x1={204} y1={250} x2={262} y2={250} />
      <Cota x1={256} y1={190} x2={256} y2={250} texto="E" tx={265} ty={226} ancora="inicio" />
    </Svg>
  );
}
