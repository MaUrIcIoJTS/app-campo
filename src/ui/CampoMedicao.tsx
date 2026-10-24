import type { Conferencia } from '../db/esquema.ts';
import { deltaDoCampo, numeroAmbiguo, numeroInvalido, valorPcm } from '../dominio/medicao.ts';
import { formatarDelta, formatarNumero } from '../dominio/numeros.ts';
import type { CampoTemplate } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';

interface Props {
  campo: CampoTemplate;
  item: ItemPcm;
  valor: string | undefined;
  conferencia: Conferencia | undefined;
  onValor: (valor: string) => void;
  onConferencia: (marca: Conferencia) => void;
}

function textoPcm(campo: CampoTemplate, item: ItemPcm): string | null {
  const v = valorPcm(campo, item);
  if (v === null) return null;
  const s = typeof v === 'number' ? formatarNumero(v) : v;
  return campo.unidade && campo.unidade !== 'un' && typeof v === 'number'
    ? `${s} ${campo.unidade}`
    : s;
}

/** Um campo da ficha: valor do PCM ao lado, Δ, e ✓/✗ manual. Grava a cada toque/tecla. */
export function CampoMedicao({ campo, item, valor, conferencia, onValor, onConferencia }: Props) {
  const idInput = `c-${item.id}-${campo.id}`;
  const pcm = textoPcm(campo, item);
  const delta = deltaDoCampo(campo, item, valor);
  const invalido = numeroInvalido(campo, valor);
  const ambiguo = numeroAmbiguo(campo, valor);

  return (
    <div class="campo-med" data-conferencia={conferencia}>
      <div class="campo-med-topo">
        <label class="campo-med-rotulo" for={idInput}>
          {campo.rotulo}
          {campo.unidade && campo.unidade !== 'un' && (
            <span class="unidade"> ({campo.unidade})</span>
          )}
        </label>
        {pcm !== null && (
          <span class="campo-med-pcm">
            <span class="rotulo-pcm">PCM</span> {pcm}
          </span>
        )}
      </div>

      {campo.tipo === 'opcoes' ? (
        <div class="opcoes" role="group" aria-labelledby={idInput}>
          <span id={idInput} hidden>
            {campo.rotulo}
          </span>
          {campo.opcoes?.map((o) => (
            <button
              key={o}
              type="button"
              class="opcao"
              aria-pressed={valor === o}
              onClick={() => onValor(valor === o ? '' : o)}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <div class="campo-med-linha">
          <input
            id={idInput}
            class="campo campo-med-input"
            type="text"
            inputMode={campo.tipo === 'numero' ? 'decimal' : 'text'}
            autoComplete="off"
            autoCapitalize={campo.tipo === 'texto' ? 'characters' : 'off'}
            enterKeyHint="next"
            value={valor ?? ''}
            aria-invalid={invalido}
            onInput={(e) => onValor(e.currentTarget.value)}
          />
          <BotoesConferencia
            conferencia={conferencia}
            onConferencia={onConferencia}
            rotulo={campo.rotulo}
          />
        </div>
      )}

      {campo.tipo === 'opcoes' && (
        <BotoesConferencia
          conferencia={conferencia}
          onConferencia={onConferencia}
          rotulo={campo.rotulo}
        />
      )}

      <p class="campo-med-info" aria-live="polite">
        {invalido && <span class="erro">Use só números (vírgula para decimal).</span>}
        {ambiguo && (
          <span class="erro">
            “{valor}”: é {valor?.replace('.', '')} ou {valor?.replace('.', ',')}? Use vírgula para
            decimal.
          </span>
        )}
        {!invalido && !ambiguo && delta !== null && (
          <span class={delta === 0 ? 'delta delta--zero' : 'delta'}>
            Δ {formatarDelta(delta)}
            {campo.unidade && campo.unidade !== 'un' ? ` ${campo.unidade}` : ''}
          </span>
        )}
        {campo.dica && <span class="dica">{campo.dica}</span>}
      </p>
    </div>
  );
}

function BotoesConferencia({
  conferencia,
  onConferencia,
  rotulo,
}: {
  conferencia: Conferencia | undefined;
  onConferencia: (marca: Conferencia) => void;
  rotulo: string;
}) {
  return (
    <span class="conferir">
      <button
        type="button"
        class="conferir-botao conferir-botao--ok"
        aria-pressed={conferencia === 'confere'}
        aria-label={`${rotulo}: confere`}
        onClick={() => onConferencia('confere')}
      >
        ✓
      </button>
      <button
        type="button"
        class="conferir-botao conferir-botao--erro"
        aria-pressed={conferencia === 'diverge'}
        aria-label={`${rotulo}: diverge`}
        onClick={() => onConferencia('diverge')}
      >
        ✗
      </button>
    </span>
  );
}
