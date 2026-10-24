import { Cota, Guia, Linha, Svg, Texto } from './base.tsx';

/** Polia de lado com 2 canais e as correias: Ø externo, canais, furo e chaveta. */
export function Polia() {
  const canal = (x: number, y: number, s: number) =>
    `${x - 10},${y} ${x - 4},${y + 18 * s} ${x + 4},${y + 18 * s} ${x + 10},${y}`;
  return (
    <Svg viewBox="0 0 300 200" titulo="Polia: diâmetro externo, canais, furo e chaveta">
      <rect class="cheia" x={110} y={30} width={80} height={150} rx={3} />
      {[130, 170].map((x) => (
        <g key={x}>
          <polygon class="furo" points={canal(x, 30, 1)} />
          <polygon class="furo" points={canal(x, 180, -1)} />
          <polygon class="escura" points={`${x - 9},26 ${x - 4},42 ${x + 4},42 ${x + 9},26`} />
        </g>
      ))}
      {/* furo e rasgo da chaveta, de face a face (tracejado: escondidos) */}
      <line class="escondida" x1={110} y1={95} x2={190} y2={95} />
      <line class="escondida" x1={110} y1={115} x2={190} y2={115} />
      <line class="escondida" x1={110} y1={89} x2={190} y2={89} />
      <Linha x1={194} y1={30} x2={216} y2={30} />
      <Linha x1={194} y1={180} x2={216} y2={180} />
      <Cota x1={208} y1={30} x2={208} y2={180} texto="Ø externo" tx={208} ty={18} />
      <Guia x1={126} y1={37} x2={82} y2={40} />
      <Texto x={4} y={45} destaque>
        Canais
      </Texto>
      <Guia x1={150} y1={89} x2={82} y2={80} />
      <Texto x={4} y={85} destaque>
        Chaveta
      </Texto>
      <Guia x1={150} y1={108} x2={82} y2={112} />
      <Texto x={4} y={117} destaque>
        Furo
      </Texto>
    </Svg>
  );
}
