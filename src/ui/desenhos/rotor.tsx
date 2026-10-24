import { Cota, Guia, Linha, Svg, Texto } from './base.tsx';

/** Rotor de frente (Ø externo, eixo, pás) e de lado (largura). */
export function Rotor() {
  const pas = [0, 45, 90, 135, 180, 225, 270, 315].map((g) => (g * Math.PI) / 180);
  return (
    <Svg viewBox="0 0 300 222" titulo="Rotor: diâmetro externo, largura, eixo e pás">
      <circle class="cheia" cx={110} cy={110} r={70} />
      {pas.map((a) => (
        <line
          key={a}
          class="peca"
          x1={Math.round(110 + 16 * Math.cos(a))}
          y1={Math.round(110 + 16 * Math.sin(a))}
          x2={Math.round(110 + 70 * Math.cos(a))}
          y2={Math.round(110 + 70 * Math.sin(a))}
        />
      ))}
      <circle class="peca" cx={110} cy={110} r={16} />
      <circle class="escura" cx={110} cy={110} r={8} />
      <Linha x1={40} y1={106} x2={40} y2={22} />
      <Linha x1={180} y1={106} x2={180} y2={22} />
      <Cota x1={40} y1={28} x2={180} y2={28} texto="Ø externo" ty={20} />
      <Guia x1={104} y1={116} x2={64} y2={186} />
      <Texto x={16} y={204} destaque>
        Ø eixo
      </Texto>
      <Guia x1={149} y1={71} x2={222} y2={40} />
      <Texto x={296} y={34} ancora="fim" destaque>
        Nº de pás
      </Texto>
      {/* de lado */}
      <rect class="peca" x={216} y={104} width={62} height={12} />
      <rect class="cheia" x={230} y={44} width={34} height={132} rx={3} />
      <Linha x1={230} y1={180} x2={230} y2={198} />
      <Linha x1={264} y1={180} x2={264} y2={198} />
      <Cota x1={230} y1={192} x2={264} y2={192} seta={6} />
      <Texto x={247} y={212} ancora="meio" destaque>
        Largura
      </Texto>
    </Svg>
  );
}
