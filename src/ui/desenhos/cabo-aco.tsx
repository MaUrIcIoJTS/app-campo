import { Cota, Linha, Svg, Texto } from './base.tsx';

/** Cabo de aço em corte: o Ø certo é o maior, por cima de duas pernas opostas. */
export function CaboAco() {
  const pernas = [0, 60, 120, 180, 240, 300].map((g) => (g * Math.PI) / 180);
  return (
    <Svg viewBox="0 0 300 172" titulo="Cabo de aço: diâmetro medido por cima das pernas">
      <circle class="escura" cx={90} cy={76} r={16} />
      {pernas.map((a) => (
        <circle
          key={a}
          class="cheia"
          cx={Math.round(90 + 36 * Math.cos(a))}
          cy={Math.round(76 + 36 * Math.sin(a))}
          r={18}
        />
      ))}
      <Linha x1={36} y1={80} x2={36} y2={150} />
      <Linha x1={144} y1={80} x2={144} y2={150} />
      <Cota x1={36} y1={144} x2={144} y2={144} texto="Ø do cabo" ty={166} />
      <Texto x={172} y={60}>
        Meça por cima
      </Texto>
      <Texto x={172} y={80}>
        de 2 pernas
      </Texto>
      <Texto x={172} y={100}>
        opostas
      </Texto>
    </Svg>
  );
}
