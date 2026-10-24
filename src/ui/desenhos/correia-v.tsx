import { Cota, Guia, Svg, Texto } from './base.tsx';

/** Correia em V: corte (o perfil) e o código gravado nela. */
export function CorreiaV() {
  return (
    <Svg viewBox="0 0 300 140" titulo="Correia em V: perfil e código gravado">
      <polygon class="cheia" points="30,50 100,50 85,100 45,100" />
      {[42, 54, 66, 78, 90].map((x) => (
        <circle key={x} class="escura" cx={x} cy={62} r={4} />
      ))}
      <Cota x1={30} y1={36} x2={100} y2={36} texto="Perfil" ty={28} />
      <Texto x={65} y={124} ancora="meio">
        (de corte)
      </Texto>
      <rect class="cheia" x={130} y={56} width={160} height={30} rx={4} />
      <Texto x={210} y={77} ancora="meio" destaque>
        B 50
      </Texto>
      <Guia x1={240} y1={86} x2={240} y2={104} />
      <Texto x={292} y={122} ancora="fim" destaque>
        Código gravado
      </Texto>
    </Svg>
  );
}
