import { Cota, Guia, Svg, Texto } from './base.tsx';

/** Redutor: entrada e saída (maciça ou vazada) com as chavetas; redução na placa. */
export function Redutor() {
  return (
    <Svg viewBox="0 0 300 254" titulo="Redutor: eixos de entrada e saída, maciça ou vazada">
      <rect class="cheia" x={70} y={30} width={120} height={110} rx={8} />
      <Texto x={130} y={58} ancora="meio">
        Redutor
      </Texto>
      <rect class="placa" x={100} y={70} width={60} height={30} rx={3} />
      <Texto x={130} y={91} ancora="meio" destaque>
        1:30
      </Texto>
      {/* entrada à esquerda */}
      <rect class="peca" x={24} y={108} width={46} height={14} />
      <rect class="escura" x={32} y={108} width={20} height={4} />
      <Guia x1={42} y1={108} x2={42} y2={92} />
      <Texto x={42} y={86} ancora="meio" destaque>
        Chaveta
      </Texto>
      <Guia x1={36} y1={122} x2={36} y2={162} />
      <Texto x={8} y={178} destaque>
        Ø entrada
      </Texto>
      {/* saída maciça à direita */}
      <rect class="peca" x={190} y={96} width={60} height={22} />
      <rect class="escura" x={206} y={96} width={28} height={5} />
      <Guia x1={220} y1={96} x2={220} y2={80} />
      <Texto x={220} y={74} ancora="meio" destaque>
        Chaveta
      </Texto>
      <Guia x1={240} y1={118} x2={240} y2={162} />
      <Texto x={292} y={178} ancora="fim" destaque>
        Ø saída (maciça)
      </Texto>
      {/* saída vazada: a face do redutor com o furo onde entra o eixo do tambor */}
      <Texto x={100} y={226} ancora="fim">
        Vazada
      </Texto>
      <rect class="cheia" x={110} y={196} width={60} height={52} rx={4} />
      <circle class="furo" cx={140} cy={222} r={15} />
      <rect class="furo" x={136} y={203} width={8} height={6} />
      <Cota x1={125} y1={222} x2={155} y2={222} seta={6} />
      <Texto x={176} y={227} destaque>
        Ø saída (furo)
      </Texto>
    </Svg>
  );
}
