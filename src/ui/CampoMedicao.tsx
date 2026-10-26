import type { Conferencia } from '../db/esquema.ts';
import { deltaDoCampo, numeroAmbiguo, numeroInvalido, valorPcm } from '../dominio/medicao.ts';
import { formatarDelta, formatarNumero } from '../dominio/numeros.ts';
import type { CampoTemplate } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';
import { irAoProximoCampo } from './foco.ts';
import { IconeConfere, IconeDiverge, IconeErro } from './Icones.tsx';

interface Props {
  campo: CampoTemplate;
  item: ItemPcm;
  /** Os outros itens do equipamento (o tambor lê o mancal na linha MANCAL do PCM). */
  irmaos: readonly ItemPcm[];
  valor: string | undefined;
  conferencia: Conferencia | undefined;
  onValor: (valor: string) => void;
  onConferencia: (marca: Conferencia) => void;
}

const unidadeVisivel = (campo: CampoTemplate) =>
  campo.unidade && campo.unidade !== 'un' ? campo.unidade : null;

function textoPcm(campo: CampoTemplate, item: ItemPcm, irmaos: readonly ItemPcm[]): string | null {
  const v = valorPcm(campo, item, irmaos);
  if (v === null) return null;
  const s = typeof v === 'number' ? formatarNumero(v) : v;
  const unidade = unidadeVisivel(campo);
  return unidade && typeof v === 'number' ? `${s} ${unidade}` : s;
}

/**
 * Um campo da ficha: valor do PCM ao lado, Δ, e ✓/✗ manual. Grava a cada toque/tecla.
 * ✓/✗ só aparece quando há valor do PCM para conferir (ou se já foi marcado). Campo sem PCM
 * tem "Não tem" (a peça não existe aqui): conta como feito, sem precisar digitar.
 */
export function CampoMedicao({
  campo,
  item,
  irmaos,
  valor,
  conferencia,
  onValor,
  onConferencia,
}: Props) {
  const idInput = `c-${item.id}-${campo.id}`;
  const idRotulo = `${idInput}-rotulo`;
  const pcm = textoPcm(campo, item, irmaos);
  const unidade = unidadeVisivel(campo);
  const delta = deltaDoCampo(campo, item, valor, irmaos);
  const invalido = numeroInvalido(campo, valor);
  const ambiguo = numeroAmbiguo(campo, valor);
  const comPcm = pcm !== null || conferencia === 'confere' || conferencia === 'diverge';
  const conferir = comPcm ? (
    <BotoesConferencia
      conferencia={conferencia}
      onConferencia={onConferencia}
      rotulo={campo.rotulo}
    />
  ) : (
    campo.tipo !== 'opcoes' && (
      <button
        type="button"
        class="nao-tem"
        aria-pressed={conferencia === 'naoTem'}
        aria-label={`${campo.rotulo}: não tem`}
        onClick={() => onConferencia('naoTem')}
      >
        {conferencia === 'naoTem' && <IconeConfere />}
        Não tem
      </button>
    )
  );
  const rotulo = (
    <>
      {campo.rotulo}
      {unidade && <span class="unidade"> ({unidade})</span>}
    </>
  );

  return (
    <div class="campo-med" data-conferencia={conferencia}>
      <div class="campo-med-topo">
        {campo.tipo === 'opcoes' ? (
          <span class="campo-med-rotulo" id={idRotulo}>
            {rotulo}
          </span>
        ) : (
          <label class="campo-med-rotulo" for={idInput} id={idRotulo}>
            {rotulo}
          </label>
        )}
        {pcm !== null && (
          <span class="campo-med-pcm">
            <span class="rotulo-pcm">PCM:</span> <span class="valor-pcm">{pcm}</span>
          </span>
        )}
      </div>

      {campo.tipo === 'opcoes' ? (
        <>
          <div class="opcoes" role="group" aria-labelledby={idRotulo}>
            {campo.opcoes?.map((o) => (
              <button
                key={o}
                type="button"
                class="opcao"
                aria-pressed={valor === o}
                onClick={() => onValor(valor === o ? '' : o)}
              >
                {valor === o && <IconeConfere />}
                {o}
              </button>
            ))}
          </div>
          {conferir && <div class="campo-med-conferir">{conferir}</div>}
        </>
      ) : (
        <div class="campo-med-linha">
          <input
            id={idInput}
            class="campo campo-med-input"
            type="text"
            inputMode={campo.tipo === 'numero' ? 'decimal' : 'text'}
            autoComplete="off"
            autoCapitalize={campo.tipo === 'texto' ? 'characters' : 'off'}
            spellcheck={false}
            enterKeyHint="next"
            value={valor ?? ''}
            aria-invalid={invalido || ambiguo}
            onInput={(e) => onValor(e.currentTarget.value)}
            onKeyDown={irAoProximoCampo}
            data-campo-ficha
          />
          {conferir}
        </div>
      )}

      <p class="campo-med-info" aria-live="polite">
        {invalido && (
          <span class="erro">
            <IconeErro />
            Use só números (vírgula para decimal).
          </span>
        )}
        {ambiguo && (
          <span class="erro">
            <IconeErro />“{valor}”: é {valor?.replace('.', '')} ou {valor?.replace('.', ',')}? Use
            vírgula para decimal.
          </span>
        )}
        {!invalido && !ambiguo && delta !== null && (
          <span class={delta === 0 ? 'delta delta--zero' : 'delta'}>
            Δ {formatarDelta(delta)}
            {unidade ? ` ${unidade}` : ''}
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
        <IconeConfere />
      </button>
      <button
        type="button"
        class="conferir-botao conferir-botao--erro"
        aria-pressed={conferencia === 'diverge'}
        aria-label={`${rotulo}: diverge`}
        onClick={() => onConferencia('diverge')}
      >
        <IconeDiverge />
      </button>
    </span>
  );
}
