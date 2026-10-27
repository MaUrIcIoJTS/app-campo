/**
 * Croquis das medidas externas: o corpo do equipamento com as cotas por letra. A letra mostra o
 * estado da cota (vazia = falta, cheia = medida, cinza = sem acesso / não tem) e, tocada, leva
 * ao campo da ficha. Carregado sob demanda (`CroquiDaGuia`), fora do chunk principal.
 */
import type { EstadoCota } from '../../dominio/croqui.ts';
import type { TipoItem } from '../../dominio/tipos.ts';
import { Centro, Cota, Guia, Linha, Svg, Texto } from './base.tsx';

type P = readonly [number, number];
const mais = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
const meio = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const r1 = (n: number) => Math.round(n * 10) / 10;
const pts = (...ps: P[]) => ps.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ');

export interface PropsCroqui {
  /** Estado de cada letra (A, B, C…). */
  estados: Readonly<Record<string, EstadoCota>>;
  onToque?: (letra: string) => void;
}

/** Letra da cota em círculo. Área de toque r = 24 (≈ 48 px na tela de 360 px). */
function Letra({
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
  const nome = { falta: 'falta medir', medida: 'medida', cinza: 'sem medida' }[estado];
  return (
    <g
      class={`letra letra--${estado}`}
      role="button"
      tabIndex={-1}
      aria-label={`Cota ${letra}: ${nome}`}
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

const letraDe =
  ({ estados, onToque }: PropsCroqui) =>
  (letra: string, p: P) => (
    <Letra p={p} letra={letra} estado={estados[letra] ?? 'falta'} onToque={onToque} />
  );

function CilindroCone({ aero, ...props }: PropsCroqui & { aero: boolean }) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 336" titulo={aero ? 'Aeroseparador: cotas A a F' : 'Silo: cotas A a E'}>
      <Centro x1={150} y1={36} x2={150} y2={306} />
      {aero ? (
        <>
          {/* acionamento (motor, polia) e a calha de alimentação em cima */}
          <rect class="cheia" x={120} y={44} width={40} height={31} />
          <Texto x={114} y={64} ancora="fim">
            acionamento
          </Texto>
          <rect class="cheia" x={182} y={50} width={32} height={25} />
          <Linha x1={182} y1={47} x2={182} y2={28} />
          <Linha x1={214} y1={47} x2={214} y2={28} />
          <Cota x1={182} y1={36} x2={214} y2={36} seta={6} />
          {letra('F', [236, 36])}
          {/* retorno de grossos: bica de lado, no cone */}
          <rect class="cheia" x={192} y={236} width={52} height={16} />
          <Texto x={226} y={274}>
            grossos
          </Texto>
          <Linha x1={247} y1={236} x2={268} y2={236} />
          <Linha x1={247} y1={252} x2={268} y2={252} />
          <Cota x1={258} y1={236} x2={258} y2={252} seta={6} externa />
          {letra('E', [280, 244])}
        </>
      ) : (
        <>
          {/* boca de carga em cima */}
          <rect class="cheia" x={176} y={44} width={20} height={31} />
          <Texto x={202} y={66}>
            carga
          </Texto>
          <Linha x1={176} y1={41} x2={176} y2={22} />
          <Linha x1={196} y1={41} x2={196} y2={22} />
          <Cota x1={176} y1={30} x2={196} y2={30} seta={6} externa />
          {letra('E', [226, 30])}
        </>
      )}
      <rect class="cheia principal" x={80} y={75} width={140} height={125} />
      <polygon class="cheia principal" points="80,200 220,200 170,285 130,285" />
      <rect class="cheia" x={133} y={285} width={34} height={15} />
      <Texto x={124} y={300} ancora="fim">
        {aero ? 'finos' : 'saída'}
      </Texto>

      {/* trena em volta: o perímetro dá o Ø */}
      <ellipse class="escondida" cx={150} cy={172} rx={70} ry={9} fill="none" />
      <Texto x={150} y={194} ancora="meio">
        perímetro
      </Texto>
      <Cota x1={80} y1={145} x2={220} y2={145} />
      {letra('A', [150, 145])}

      <Linha x1={77} y1={75} x2={46} y2={75} />
      <Linha x1={77} y1={200} x2={46} y2={200} />
      <Linha x1={127} y1={285} x2={46} y2={285} />
      <Cota x1={56} y1={75} x2={56} y2={200} />
      {letra('B', [56, 137])}
      <Cota x1={56} y1={200} x2={56} y2={285} />
      {letra('C', [56, 242])}

      <Linha x1={133} y1={303} x2={133} y2={324} />
      <Linha x1={167} y1={303} x2={167} y2={324} />
      <Cota x1={133} y1={316} x2={167} y2={316} seta={7} />
      {letra('D', [190, 316])}
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

/** Peneira: caixa inclinada de lado (A, C, D) e de frente (B; E = decks). */
function CaixaInclinada(props: PropsCroqui) {
  const letra = letraDe(props);
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
    <Svg viewBox="0 0 300 330" titulo="Peneira: cotas A a E">
      <polygon class="cheia" points={pts([75, 38], [105, 38], topo(105), topo(75))} />
      <polygon class="cheia principal" points={pts(p0, p1, p2, p3)} />
      {[1 / 3, 2 / 3].map((t) => {
        const [i, f] = deck(t);
        return (
          <line key={t} class="escondida" x1={r1(i[0])} y1={r1(i[1])} x2={r1(f[0])} y2={r1(f[1])} />
        );
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
        de frente
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

/** Filtro de mangas: caixa + tremonha, de frente (A, E) e de lado (B, C, D). */
function CaixaTremonha(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 310" titulo="Filtro de mangas: cotas A a E">
      <rect class="cheia principal" x={40} y={50} width={110} height={110} />
      <polygon class="cheia principal" points="40,160 150,160 108,236 82,236" />
      <rect class="cheia" x={82} y={236} width={26} height={14} />
      <rect class="cheia principal" x={185} y={50} width={70} height={110} />
      <polygon class="cheia principal" points="185,160 255,160 228,236 212,236" />
      <rect class="cheia" x={212} y={236} width={16} height={14} />
      <Texto x={95} y={298} ancora="meio">
        frente
      </Texto>
      <Texto x={220} y={298} ancora="meio">
        lado
      </Texto>

      <Linha x1={40} y1={47} x2={40} y2={24} />
      <Linha x1={150} y1={47} x2={150} y2={24} />
      <Cota x1={40} y1={32} x2={150} y2={32} />
      {letra('A', [95, 32])}
      <Linha x1={185} y1={47} x2={185} y2={24} />
      <Linha x1={255} y1={47} x2={255} y2={24} />
      <Cota x1={185} y1={32} x2={255} y2={32} />
      {letra('B', [220, 32])}

      <Linha x1={258} y1={50} x2={284} y2={50} />
      <Linha x1={258} y1={160} x2={284} y2={160} />
      <Linha x1={231} y1={236} x2={284} y2={236} />
      <Cota x1={274} y1={50} x2={274} y2={160} />
      {letra('C', [274, 105])}
      <Cota x1={274} y1={160} x2={274} y2={236} />
      {letra('D', [274, 198])}

      <Linha x1={82} y1={253} x2={82} y2={276} />
      <Linha x1={108} y1={253} x2={108} y2={276} />
      <Cota x1={82} y1={268} x2={108} y2={268} seta={6} externa />
      {letra('E', [140, 268])}
    </Svg>
  );
}

/** Moinho / britador: caixa de frente (A, D, E) e de lado (B, C). */
function Caixa(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 250" titulo="Moinho / britador: cotas A a E">
      <rect class="cheia" x={75} y={52} width={40} height={18} />
      <rect class="cheia principal" x={40} y={70} width={120} height={120} />
      <rect class="cheia" x={82} y={190} width={26} height={16} />
      <rect class="cheia principal" x={195} y={70} width={70} height={120} />
      <Texto x={100} y={238} ancora="meio">
        frente
      </Texto>
      <Texto x={230} y={238} ancora="meio">
        lado
      </Texto>

      <Linha x1={40} y1={67} x2={40} y2={28} />
      <Linha x1={160} y1={67} x2={160} y2={28} />
      <Cota x1={40} y1={36} x2={160} y2={36} />
      {letra('A', [130, 36])}
      <Linha x1={195} y1={67} x2={195} y2={28} />
      <Linha x1={265} y1={67} x2={265} y2={28} />
      <Cota x1={195} y1={36} x2={265} y2={36} />
      {letra('B', [230, 36])}
      <Linha x1={268} y1={70} x2={292} y2={70} />
      <Linha x1={268} y1={190} x2={292} y2={190} />
      <Cota x1={282} y1={70} x2={282} y2={190} />
      {letra('C', [282, 130])}

      {/* bocas: o tamanho vai no campo (L × C) */}
      <Guia x1={86} y1={60} x2={38} y2={84} />
      {letra('D', [24, 96])}
      <Guia x1={92} y1={200} x2={38} y2={190} />
      {letra('E', [24, 182])}
    </Svg>
  );
}

/** Exaustor / recirculador: voluta de frente (B, C, D, E) e de lado (A). */
function Voluta(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 285" titulo="Exaustor: cotas A a E">
      <path class="cheia principal" d="M130,75 L130,40 L205,40 L205,150 A75,75 0 1 1 130,75 Z" />
      <circle class="furo" cx={130} cy={150} r={32} />
      <rect class="cheia principal" x={238} y={40} width={40} height={185} />
      <Centro x1={226} y1={150} x2={290} y2={150} />
      <Texto x={130} y={278} ancora="meio">
        frente
      </Texto>
      <Texto x={258} y={250} ancora="meio">
        lado
      </Texto>

      {letra('E', [168, 20])}
      <Linha x1={238} y1={37} x2={238} y2={12} />
      <Linha x1={278} y1={37} x2={278} y2={12} />
      <Cota x1={238} y1={20} x2={278} y2={20} seta={6} />
      {letra('A', [258, 20])}

      <Linha x1={126} y1={40} x2={22} y2={40} />
      <Linha x1={126} y1={225} x2={22} y2={225} />
      <Cota x1={32} y1={40} x2={32} y2={225} />
      {letra('B', [32, 132])}

      <Linha x1={55} y1={154} x2={55} y2={256} />
      <Linha x1={205} y1={154} x2={205} y2={256} />
      <Cota x1={55} y1={248} x2={205} y2={248} />
      {letra('C', [130, 248])}

      <Cota x1={98} y1={150} x2={162} y2={150} seta={7} />
      {letra('D', [130, 150])}
    </Svg>
  );
}

/** Rosca: de lado (A, E) e o corte do tubo ou da calha (B, C, D). */
function Rosca(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 285" titulo="Rosca: cotas A a E">
      <Centro x1={10} y1={80} x2={290} y2={80} />
      <rect class="cheia" x={16} y={72} width={14} height={16} />
      <rect class="cheia" x={270} y={72} width={14} height={16} />
      <rect class="cheia" x={60} y={42} width={30} height={18} />
      <rect class="cheia" x={210} y={100} width={30} height={18} />
      <rect class="cheia principal" x={40} y={60} width={220} height={40} />
      <rect class="cheia" x={34} y={52} width={6} height={56} />
      <rect class="cheia" x={260} y={52} width={6} height={56} />

      <Linha x1={40} y1={49} x2={40} y2={16} />
      <Linha x1={260} y1={49} x2={260} y2={16} />
      <Cota x1={40} y1={24} x2={260} y2={24} />
      {letra('A', [150, 24])}
      <Linha x1={23} y1={92} x2={23} y2={148} />
      <Linha x1={277} y1={92} x2={277} y2={148} />
      <Cota x1={23} y1={140} x2={277} y2={140} />
      {letra('E', [150, 140])}

      {/* corte: tubo ou calha (B) */}
      <circle class="cheia principal" cx={70} cy={215} r={32} />
      <Cota x1={38} y1={215} x2={102} y2={215} seta={7} />
      {letra('C', [70, 215])}
      <Texto x={70} y={272} ancora="meio">
        tubo
      </Texto>
      {letra('B', [138, 215])}
      <path class="cheia principal" d="M183,183 L183,215 A32,32 0 0 0 247,215 L247,183" />
      <Linha x1={183} y1={180} x2={183} y2={160} />
      <Linha x1={247} y1={180} x2={247} y2={160} />
      <Cota x1={183} y1={168} x2={247} y2={168} />
      {letra('C', [215, 168])}
      <Linha x1={250} y1={183} x2={286} y2={183} />
      <Linha x1={219} y1={247} x2={286} y2={247} />
      <Cota x1={274} y1={183} x2={274} y2={247} />
      {letra('D', [274, 215])}
      <Texto x={215} y={272} ancora="meio">
        calha
      </Texto>
    </Svg>
  );
}

/** Elevador de canecas: coluna de frente (A, C, D, E) e o corte de cima (B). */
function Coluna(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 330" titulo="Elevador de canecas: cotas A a E">
      <polygon class="cheia" points="180,62 214,84 214,104 180,82" />
      <polygon class="cheia" points="100,266 68,246 68,268 100,290" />
      <rect class="cheia principal" x={110} y={80} width={60} height={180} />
      <rect class="cheia principal" x={100} y={30} width={80} height={50} />
      <rect class="cheia principal" x={100} y={260} width={80} height={50} />
      <circle class="furo" cx={140} cy={55} r={6} />
      <circle class="furo" cx={140} cy={285} r={6} />
      <Texto x={94} y={50} ancora="fim">
        cabeça
      </Texto>
      <Texto x={186} y={304}>
        pé
      </Texto>

      <Linha x1={148} y1={55} x2={260} y2={55} />
      <Linha x1={148} y1={285} x2={260} y2={285} />
      <Cota x1={250} y1={55} x2={250} y2={285} />
      {letra('C', [250, 200])}
      <Cota x1={110} y1={170} x2={170} y2={170} seta={7} />
      {letra('A', [140, 170])}

      <Texto x={70} y={112} ancora="meio">
        de cima
      </Texto>
      <rect class="cheia principal" x={40} y={122} width={60} height={36} />
      <Linha x1={37} y1={122} x2={8} y2={122} />
      <Linha x1={37} y1={158} x2={8} y2={158} />
      <Cota x1={18} y1={122} x2={18} y2={158} seta={6} />
      {letra('B', [18, 140])}

      <Guia x1={74} y1={258} x2={44} y2={226} />
      {letra('D', [34, 214])}
      <Guia x1={210} y1={96} x2={234} y2={120} />
      {letra('E', [244, 132])}
    </Svg>
  );
}

/** Válvula (rotativa, pendular): corpo com flanges, de frente (A, B, C) e de lado (D). */
function CorpoFlange(props: PropsCroqui) {
  const letra = letraDe(props);
  return (
    <Svg viewBox="0 0 300 250" titulo="Válvula: cotas A a D">
      <rect class="cheia" x={30} y={58} width={130} height={12} />
      <rect class="cheia principal" x={40} y={70} width={110} height={110} />
      <rect class="cheia" x={30} y={180} width={130} height={12} />
      <rect class="cheia" x={182} y={58} width={96} height={12} />
      <rect class="cheia principal" x={190} y={70} width={80} height={110} />
      <rect class="cheia" x={182} y={180} width={96} height={12} />
      <Centro x1={176} y1={125} x2={294} y2={125} />
      <Texto x={95} y={242} ancora="meio">
        frente
      </Texto>
      <Texto x={230} y={242} ancora="meio">
        lado
      </Texto>

      <Guia x1={95} y1={62} x2={95} y2={46} />
      {letra('A', [95, 32])}
      <Linha x1={27} y1={58} x2={8} y2={58} />
      <Linha x1={27} y1={192} x2={8} y2={192} />
      <Cota x1={18} y1={58} x2={18} y2={192} />
      {letra('B', [18, 125])}
      <Linha x1={40} y1={195} x2={40} y2={218} />
      <Linha x1={150} y1={195} x2={150} y2={218} />
      <Cota x1={40} y1={210} x2={150} y2={210} />
      {letra('C', [95, 210])}
      <Linha x1={190} y1={195} x2={190} y2={218} />
      <Linha x1={270} y1={195} x2={270} y2={218} />
      <Cota x1={190} y1={210} x2={270} y2={210} />
      {letra('D', [230, 210])}
    </Svg>
  );
}

/** Croqui de cada tipo de item "corpo-…" (null nos outros tipos). */
export function Croqui({ tipo, ...props }: PropsCroqui & { tipo: TipoItem }) {
  switch (tipo) {
    case 'corpo-aeroseparador':
      return <CilindroCone aero {...props} />;
    case 'corpo-silo':
      return <CilindroCone aero={false} {...props} />;
    case 'corpo-peneira':
      return <CaixaInclinada {...props} />;
    case 'corpo-filtro':
      return <CaixaTremonha {...props} />;
    case 'corpo-caixa':
      return <Caixa {...props} />;
    case 'corpo-voluta':
      return <Voluta {...props} />;
    case 'corpo-rosca':
      return <Rosca {...props} />;
    case 'corpo-elevador':
      return <Coluna {...props} />;
    case 'corpo-valvula':
      return <CorpoFlange {...props} />;
    default:
      return null;
  }
}
