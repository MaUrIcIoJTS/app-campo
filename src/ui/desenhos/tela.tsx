import { Cota, Svg, Texto } from './base.tsx';

/** Tela de peneira de perto: malha = vão livre entre fios; fio = Ø do arame. */
export function Tela() {
  const fios = [30, 100, 170, 240];
  return (
    <Svg viewBox="0 0 300 190" titulo="Tela: malha e fio">
      {[20, 90, 160].map((y) => (
        <rect key={y} class="escura" x={10} y={y} width={270} height={14} rx={7} />
      ))}
      {fios.map((x) => (
        <rect key={x} class="escura" x={x} y={4} width={14} height={180} rx={7} />
      ))}
      <Cota x1={44} y1={62} x2={100} y2={62} texto="Malha" ty={56} />
      <Cota x1={170} y1={132} x2={184} y2={132} seta={7} externa />
      <Texto x={208} y={137} destaque>
        Fio
      </Texto>
    </Svg>
  );
}
