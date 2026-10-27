import { useState } from 'preact/hooks';
import type { Conferencia } from '../db/esquema.ts';
import {
  comEstimado,
  diametroDoPerimetro,
  ehEstimado,
  ehSemAcesso,
  estadoDaCota,
  SEM_ACESSO,
} from '../dominio/croqui.ts';
import { numeroAmbiguo, numeroInvalido } from '../dominio/medicao.ts';
import { formatarNumero, medidaAmbigua } from '../dominio/numeros.ts';
import type { CampoTemplate } from '../dominio/templates/registro.ts';
import type { ItemPcm } from '../dominio/tipos.ts';
import { irAoProximoCampo } from './foco.ts';
import { IconeConfere, IconeErro } from './Icones.tsx';

/** Id do campo na ficha (o mesmo do `CampoMedicao`): a letra do croqui leva até ele. */
export const idDoCampo = (itemId: string, campoId: string) => `c-${itemId}-${campoId}`;

interface Props {
  campo: CampoTemplate;
  item: ItemPcm;
  valor: string | undefined;
  /** Perímetro medido com a trena (só no campo de Ø com `perimetro`). */
  perimetro: string | undefined;
  conferencia: Conferencia | undefined;
  onValor: (valor: string) => void;
  onPerimetro: (valor: string) => void;
  onConferencia: (marca: Conferencia) => void;
}

/**
 * Uma cota do croqui: a letra do desenho, o valor e, ao lado, "Sem acesso" (campo vazio) ou
 * "≈ Estimado" (campo com valor). Os dois ficam no próprio texto ("sem acesso", "≈ 1800"). O
 * botão nunca apaga um número digitado: "Sem acesso" só aparece com o campo vazio.
 */
export function CampoCroqui({
  campo,
  item,
  valor,
  perimetro,
  conferencia,
  onValor,
  onPerimetro,
  onConferencia,
}: Props) {
  const [abrirPerimetro, setAbrirPerimetro] = useState(false);
  const idInput = idDoCampo(item.id, campo.id);
  const idPerimetro = `${idInput}-perimetro`;
  const semAcesso = ehSemAcesso(valor);
  const naoTem = conferencia === 'naoTem';
  const temValor = !!valor?.trim() && !semAcesso;
  const estimado = ehEstimado(valor);
  const temPerimetro = !!campo.perimetro && !!perimetro?.trim();
  const diametro = temPerimetro ? diametroDoPerimetro(perimetro) : null;
  const verPerimetro =
    !!campo.perimetro && !semAcesso && !naoTem && (temPerimetro || abrirPerimetro);
  const estado = estadoDaCota(valor, temPerimetro ? perimetro : undefined, conferencia);
  const invalido = numeroInvalido(campo, valor);
  const ambiguo = numeroAmbiguo(campo, valor);
  const unidade = campo.unidade && campo.unidade !== 'un' ? campo.unidade : null;
  const chips = {
    naoTem: !temValor && !semAcesso && !temPerimetro,
    perimetro: !!campo.perimetro && !temValor && !semAcesso && !naoTem && !temPerimetro,
  };

  return (
    <div class="campo-med campo-croqui" data-conferencia={naoTem ? 'naoTem' : undefined}>
      <div class="campo-med-topo">
        <label class="campo-med-rotulo" for={idInput}>
          <span class={`letra-campo letra-campo--${estado}`} aria-hidden="true">
            {campo.letra}
          </span>
          {campo.rotulo}
          {unidade && <span class="unidade"> ({unidade})</span>}
        </label>
      </div>

      <div class="campo-med-linha">
        <input
          id={idInput}
          class="campo campo-med-input"
          type="text"
          inputMode={campo.tipo === 'numero' ? 'decimal' : 'text'}
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          enterKeyHint="next"
          value={semAcesso ? '' : (valor ?? '')}
          placeholder={
            semAcesso ? '—' : diametro !== null ? `${formatarNumero(diametro)}` : undefined
          }
          disabled={semAcesso || naoTem}
          aria-invalid={invalido || ambiguo}
          onInput={(e) => onValor(e.currentTarget.value)}
          onKeyDown={irAoProximoCampo}
          data-campo-ficha
        />
        {temValor ? (
          <button
            type="button"
            class="nao-tem"
            aria-pressed={estimado}
            aria-label={`${campo.rotulo}: estimado`}
            onClick={() => onValor(comEstimado(valor ?? '', !estimado))}
          >
            {estimado && <IconeConfere />}≈ Estimado
          </button>
        ) : (
          // Ø já medido pelo perímetro: nada de "Sem acesso" escondendo a medida.
          !naoTem &&
          !temPerimetro && (
            <button
              type="button"
              class="nao-tem"
              aria-pressed={semAcesso}
              aria-label={`${campo.rotulo}: sem acesso`}
              onClick={() => onValor(semAcesso ? '' : SEM_ACESSO)}
            >
              {semAcesso && <IconeConfere />}
              Sem acesso
            </button>
          )
        )}
      </div>

      {(chips.naoTem || chips.perimetro) && (
        <div class="croqui-extras">
          {chips.naoTem && (
            <button
              type="button"
              class="opcao opcao--chip"
              aria-pressed={naoTem}
              aria-label={`${campo.rotulo}: não tem`}
              onClick={() => onConferencia('naoTem')}
            >
              {naoTem && <IconeConfere />}
              Não tem
            </button>
          )}
          {chips.perimetro && (
            <button
              type="button"
              class="opcao opcao--chip"
              aria-pressed={abrirPerimetro}
              onClick={() => setAbrirPerimetro(!abrirPerimetro)}
            >
              {abrirPerimetro && <IconeConfere />}
              Medi o perímetro
            </button>
          )}
        </div>
      )}

      {verPerimetro && (
        <div class="croqui-perimetro">
          <label class="campo-med-rotulo" for={idPerimetro}>
            Perímetro {unidade && <span class="unidade">({unidade})</span>}
          </label>
          <div class="campo-med-linha">
            <input
              id={idPerimetro}
              class="campo campo-med-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              value={perimetro ?? ''}
              aria-invalid={temPerimetro && diametro === null}
              onInput={(e) => onPerimetro(e.currentTarget.value)}
              onKeyDown={irAoProximoCampo}
              data-campo-ficha
            />
            {temPerimetro && (
              <button
                type="button"
                class="nao-tem"
                aria-pressed={ehEstimado(perimetro)}
                aria-label="Perímetro: estimado"
                onClick={() => onPerimetro(comEstimado(perimetro ?? '', !ehEstimado(perimetro)))}
              >
                {ehEstimado(perimetro) && <IconeConfere />}≈ Estimado
              </button>
            )}
          </div>
          <p class="campo-med-info" aria-live="polite">
            {diametro !== null ? (
              <span class="delta delta--zero">
                {/* span comum: no flex do .delta, o espaço antes do número sumiria */}
                <span>
                  {`Ø = ${perimetro?.replace(/^\s*≈\s*/, '')} ÷ π = `}
                  <strong>
                    {formatarNumero(diametro)}
                    {unidade ? ` ${unidade}` : ''}
                  </strong>
                </span>
              </span>
            ) : temPerimetro ? (
              <span class="erro">
                <IconeErro />
                Use só números (vírgula para decimal).
              </span>
            ) : (
              <span class="dica">Passe a trena em volta do corpo.</span>
            )}
            {medidaAmbigua(perimetro) && (
              <span class="erro">
                <IconeErro />“{perimetro}”: use vírgula para decimal.
              </span>
            )}
          </p>
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
        {campo.dica && <span class="dica">{campo.dica}</span>}
      </p>
    </div>
  );
}
