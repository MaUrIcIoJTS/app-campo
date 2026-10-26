import { Centro, Cota, Guia, Linha, Svg, Texto } from './base.tsx';

/** Tambor de lado: face, Ø, eixo nos mancais, ponta com chaveta e comprimento do eixo. */
export function Tambor() {
  return (
    <Svg viewBox="0 0 300 232" titulo="Tambor: face, diâmetro, eixo, ponta e chaveta">
      <Centro x1={10} y1={90} x2={296} y2={90} />
      {/* eixo (fora do tambor) e ponta mais fina com rasgo de chaveta */}
      <rect class="peca" x={20} y={80} width={60} height={20} />
      <rect class="peca" x={220} y={80} width={42} height={20} />
      <rect class="peca" x={262} y={83} width={28} height={14} />
      <rect class="escura" x={268} y={83} width={16} height={4} />
      {/* mancais */}
      <rect class="cheia" x={34} y={64} width={24} height={48} rx={3} />
      <rect class="cheia" x={26} y={112} width={40} height={10} />
      <rect class="cheia" x={230} y={64} width={24} height={48} rx={3} />
      <rect class="cheia" x={222} y={112} width={40} height={10} />
      {/* corpo do tambor */}
      <rect class="cheia principal" x={80} y={40} width={140} height={100} rx={6} />
      <Cota x1={108} y1={40} x2={108} y2={140} texto="Ø tambor" tx={116} ty={72} ancora="inicio" />
      <Linha x1={80} y1={36} x2={80} y2={18} />
      <Linha x1={220} y1={36} x2={220} y2={18} />
      <Cota x1={80} y1={24} x2={220} y2={24} texto="Face" ty={17} />
      <Guia x1={69} y1={100} x2={69} y2={150} />
      <Texto x={28} y={166} destaque>
        Ø eixo no mancal
      </Texto>
      <Guia x1={278} y1={97} x2={278} y2={150} />
      <Texto x={282} y={166} ancora="fim" destaque>
        Ø ponta
      </Texto>
      <Guia x1={278} y1={83} x2={278} y2={50} />
      <Texto x={296} y={44} ancora="fim" destaque>
        Chaveta
      </Texto>
      <Linha x1={20} y1={104} x2={20} y2={204} />
      <Linha x1={290} y1={101} x2={290} y2={204} />
      <Cota x1={20} y1={198} x2={290} y2={198} texto="Comprimento do eixo" ty={222} />
    </Svg>
  );
}
