/**
 * PROTÓTIPO (fora do app): croquis com as cotas por letra para aprovar o traço. Usa as mesmas
 * peças dos desenhos "onde medir" (`src/ui/desenhos/base.tsx`).
 */
import { Centro, Cota, Guia, Linha, Svg, Texto } from '../../src/ui/desenhos/base.tsx';

type P = readonly [number, number];
const mais = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const meio = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const r1 = (n: number) => Math.round(n * 10) / 10;
const pts = (...ps: P[]) => ps.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ');

/** Estado de uma cota: falta medir, medida (inclusive estimada) ou sem acesso. */
export type EstadoCota = 'falta' | 'medida' | 'semAcesso';

/**
 * Letra da cota em círculo: vazio = falta, cheio = medida, cinza = sem acesso. A área de toque
 * (r = 24 no viewBox de 300 ≈ 58 px em 360 px) leva ao campo da ficha.
 */
export function Letra({
  p,
  letra,
  estado,
  onToque,
}: {
  p: P;
  letra: string;
  estado: EstadoCota;
  onToque?: (letra: string) => void;
}) {
  return (
    <g
      class={`letra letra--${estado}`}
      role="button"
      aria-label={`Cota ${letra}`}
      onClick={() => onToque?.(letra)}
    >
      <circle class="letra-toque" cx={p[0]} cy={p[1]} r={24} />
      <circle class="letra-fundo" cx={p[0]} cy={p[1]} r={13} />
      <text x={p[0]} y={p[1] + 5} class="meio">
        {letra}
      </text>
    </g>
  );
}

interface PropsCroqui {
  estados: Readonly<Record<string, EstadoCota>>;
  onToque?: (letra: string) => void;
}

const cotaDe =
  ({ estados, onToque }: PropsCroqui) =>
  (letra: string, p: P) => (
    <Letra p={p} letra={letra} estado={estados[letra] ?? 'falta'} onToque={onToque} />
  );

/** Aeroseparador / silo: cilindro + cone, de frente. */
export function CilindroCone(props: PropsCroqui) {
  const letra = cotaDe(props);
  return (
    <Svg viewBox="0 0 300 336" titulo="Cilindro com cone: cotas A a F">
      <Centro x1={150} y1={30} x2={150} y2={306} />
      {/* duto de saída em cima */}
      <rect class="cheia" x={125} y={36} width={50} height={39} />
      {/* corpo e cone */}
      <rect class="cheia principal" x={80} y={75} width={140} height={125} />
      <polygon
        class="cheia principal"
        points={pts([80, 200], [220, 200], [170, 285], [130, 285])}
      />
      <rect class="cheia" x={130} y={285} width={40} height={15} />
      {/* entrada lateral */}
      <rect class="cheia" x={220} y={84} width={44} height={36} />
      <Texto x={224} y={140}>
        entrada
      </Texto>
      {/* trena em volta: o perímetro dá o Ø */}
      <ellipse class="escondida" cx={150} cy={172} rx={70} ry={9} fill="none" />
      <Texto x={150} y={194} ancora="meio">
        perímetro
      </Texto>

      <Linha x1={125} y1={33} x2={125} y2={14} />
      <Linha x1={175} y1={33} x2={175} y2={14} />
      <Cota x1={125} y1={22} x2={175} y2={22} seta={7} />
      {letra('E', [196, 22])}

      <Cota x1={80} y1={145} x2={220} y2={145} />
      {letra('A', [150, 145])}

      <Linha x1={77} y1={75} x2={46} y2={75} />
      <Linha x1={77} y1={200} x2={46} y2={200} />
      <Linha x1={127} y1={285} x2={46} y2={285} />
      <Cota x1={56} y1={75} x2={56} y2={200} />
      {letra('B', [56, 137])}
      <Cota x1={56} y1={200} x2={56} y2={285} />
      {letra('C', [56, 242])}

      <Linha x1={267} y1={84} x2={290} y2={84} />
      <Linha x1={267} y1={120} x2={290} y2={120} />
      <Cota x1={280} y1={84} x2={280} y2={120} seta={6} />
      {letra('F', [280, 102])}

      <Linha x1={130} y1={303} x2={130} y2={324} />
      <Linha x1={170} y1={303} x2={170} y2={324} />
      <Cota x1={130} y1={316} x2={170} y2={316} seta={7} />
      {letra('D', [192, 316])}
    </Svg>
  );
}

/** Mola do apoio da peneira, de `y1` (caixa) até `y2` (base). */
function Mola({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const voltas = 6;
  const passo = (y2 - y1 - 8) / voltas;
  const zig: P[] = [[x, y1]];
  for (let k = 0; k < voltas; k++)
    zig.push([x + (k % 2 === 0 ? 9 : -9), y1 + 4 + passo * (k + 0.5)]);
  zig.push([x, y2 - 4], [x, y2]);
  return (
    <>
      <polyline class="peca" points={pts(...zig)} />
      <line class="peca" x1={x - 12} y1={y2} x2={x + 12} y2={y2} />
    </>
  );
}

/** Peneira: caixa inclinada de lado (A, C, D) e de frente (B, E = decks). */
export function CaixaInclinada(props: PropsCroqui) {
  const letra = cotaDe(props);
  const ang = (15 * Math.PI) / 180;
  const u: P = [Math.cos(ang), Math.sin(ang)]; // ao longo da caixa, descendo
  const n: P = [Math.sin(ang), -Math.cos(ang)]; // para cima da caixa
  const [L, H] = [180, 50];
  const p0: P = [40, 110]; // ponta alta, embaixo
  const p1 = mais(p0, u, L); // ponta baixa, embaixo
  const p3 = mais(p0, n, H);
  const p2 = mais(p1, n, H);
  const deck = (t: number) => [mais(p0, n, H * t), mais(p1, n, H * t)] as const;
  const linha = (a: P, b: P) => <Linha x1={r1(a[0])} y1={r1(a[1])} x2={r1(b[0])} y2={r1(b[1])} />;
  const cota = (a: P, b: P) => <Cota x1={r1(a[0])} y1={r1(a[1])} x2={r1(b[0])} y2={r1(b[1])} />;
  const [a1, a2] = [mais(p3, n, 40), mais(p2, n, 40)];
  const [c1, c2] = [mais(p0, u, -22), mais(p3, u, -22)];
  // calha de entrada sobre a ponta alta
  const topo = (x: number): P => [x, p3[1] + (x - p3[0]) * Math.tan(ang)];
  const chao = 226;
  // inclinação: entre a horizontal e o fundo da caixa prolongado, depois da ponta baixa
  const arcoIni: P = [p1[0] + 55, p1[1]];
  const arcoFim = mais(p1, u, 55);
  const d: P = [p1[0] + 72 * Math.cos(ang / 2), p1[1] + 72 * Math.sin(ang / 2)];
  const molas = [30, 150].map((k) => mais(p0, u, k));
  return (
    <Svg viewBox="0 0 300 330" titulo="Caixa inclinada (peneira): cotas A a E">
      <polygon class="cheia" points={pts([75, 38], [105, 38], topo(105), topo(75))} />
      <polygon class="cheia principal" points={pts(p0, p1, p2, p3)} />
      {[1 / 3, 2 / 3].map((t) => {
        const [i, f] = deck(t);
        return <line key={t} class="escondida" x1={i[0]} y1={i[1]} x2={f[0]} y2={f[1]} />;
      })}
      {molas.map((m) => (
        <Mola key={m[0]} x={r1(m[0])} y1={r1(m[1])} y2={chao - 4} />
      ))}
      <line class="peca" x1={20} y1={chao} x2={240} y2={chao} />

      {linha(mais(p3, n, 4), mais(p3, n, 48))}
      {linha(mais(p2, n, 4), mais(p2, n, 48))}
      {cota(a1, a2)}
      {letra('A', meio(a1, a2))}

      {linha(mais(p0, u, -4), mais(p0, u, -30))}
      {linha(mais(p3, u, -4), mais(p3, u, -30))}
      {cota(c1, c2)}
      {letra('C', meio(c1, c2))}

      {linha([p1[0] + 4, p1[1]], [296, p1[1]])}
      {linha(mais(p1, u, 4), mais(p1, u, 85))}
      <g class="cota">
        <path
          d={`M${r1(arcoIni[0])},${r1(arcoIni[1])} A55,55 0 0 1 ${r1(arcoFim[0])},${r1(arcoFim[1])}`}
          fill="none"
        />
      </g>
      {letra('D', d)}

      {/* de frente: largura e os decks */}
      <Texto x={160} y={271}>
        De frente
      </Texto>
      <rect class="cheia principal" x={40} y={252} width={100} height={44} />
      <line class="escondida" x1={40} y1={267} x2={140} y2={267} />
      <line class="escondida" x1={40} y1={281} x2={140} y2={281} />
      <Guia x1={124} y1={267} x2={166} y2={292} />
      {letra('E', [180, 296])}
      <Linha x1={40} y1={299} x2={40} y2={320} />
      <Linha x1={140} y1={299} x2={140} y2={320} />
      <Cota x1={40} y1={312} x2={140} y2={312} />
      {letra('B', [90, 312])}
    </Svg>
  );
}
