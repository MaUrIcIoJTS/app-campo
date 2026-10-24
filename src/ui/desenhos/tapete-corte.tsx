import { Cota, Linha, Svg, Texto } from './base.tsx';

/** Corte do tapete: coberturas, lonas (conte), espessura e largura. */
export function TapeteCorte() {
  return (
    <Svg viewBox="0 0 300 192" titulo="Corte do tapete: coberturas, lonas, espessura e largura">
      <rect class="cheia" x={16} y={36} width={180} height={28} />
      <Texto x={106} y={55} ancora="meio">
        Cobertura superior
      </Texto>
      <rect class="escura" x={16} y={68} width={180} height={8} />
      <rect class="escura" x={16} y={80} width={180} height={8} />
      <rect class="escura" x={16} y={92} width={180} height={8} />
      <rect class="cheia" x={16} y={104} width={180} height={22} />
      <Texto x={106} y={120} ancora="meio">
        Cobertura inferior
      </Texto>
      {/* chave abrangendo todas as lonas */}
      <path class="peca" d="M200,68 L206,68 L206,100 L200,100 M206,84 L214,84" />
      <Texto x={218} y={82} destaque>
        Lonas
      </Texto>
      <Texto x={218} y={100} destaque>
        (conte)
      </Texto>
      {/* espessura total, à direita */}
      <Linha x1={200} y1={36} x2={292} y2={36} />
      <Linha x1={200} y1={126} x2={292} y2={126} />
      <Cota x1={284} y1={36} x2={284} y2={126} />
      <Texto x={292} y={26} ancora="fim" destaque>
        Espessura total
      </Texto>
      {/* largura, embaixo */}
      <Linha x1={16} y1={130} x2={16} y2={170} />
      <Linha x1={196} y1={130} x2={196} y2={170} />
      <Cota x1={16} y1={164} x2={196} y2={164} texto="Largura" ty={186} />
    </Svg>
  );
}
