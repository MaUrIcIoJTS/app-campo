/**
 * Restaurar um backup: troca TODOS os dados do aparelho pelos do backup.
 * 1. o app não pode ter nada gravando (fila, diário, foto, importação) — igual à importação;
 * 2. enquanto restaura, o app mostra só a tela de restaurar (`useRestaurando`): o técnico não
 *    consegue voltar para a ficha e medir algo que a restauração apagaria;
 * 3. faz uma cópia automática (backup .json completo) do estado atual;
 * 4. grava cópia + backup numa transação só, conferindo que nada mudou desde a cópia
 *    (outra janela, por exemplo) — se mudou, ou se falhar, nada muda, nem as cópias antigas.
 */
import { useEffect, useState } from 'preact/hooks';
import { registrosNoDiario } from '../db/edicao.ts';
import { VERSAO_BANCO } from '../db/esquema.ts';
import {
  DadosMudaramDuranteRestauracao,
  gravarRestauracao,
  impressaoDe,
  lerTudo,
  type CopiaAntesDeRestaurar,
} from '../db/repositorio.ts';
import {
  emOperacaoCritica,
  filaDeGravacao,
  semEspaco,
  semRecarregarDurante,
} from '../db/salvamento.ts';
import { gerarBackup } from './backup.ts';
import type { BackupLido } from './lerBackup.ts';
import { nomeDaCopiaAutomatica } from './nomes.ts';
import { VERSAO_APP } from './preparar.ts';
import { comTelaAcesa } from './telaAcesa.ts';

export const MENSAGEM_RESTAURAR = {
  pendente:
    'Ainda há medidas ou fotos sendo salvas no aparelho. Espere aparecer “✓ Salvo no aparelho” e tente de novo (se aparecer “⚠ Celular sem espaço”, libere espaço antes). Nada foi alterado.',
  mudou:
    'As medidas mudaram enquanto o app restaurava (o app está aberto em outra janela?). Nada foi alterado. Feche a outra janela e tente de novo.',
  semEspaco:
    'Celular sem espaço para guardar a cópia e restaurar. Nada foi alterado. Apague fotos e vídeos do celular (fora do app) e tente de novo.',
  gravar: 'Não consegui gravar no aparelho. Nada foi alterado. Feche e abra o app e tente de novo.',
};

/** Não restaurou: a mensagem já é o texto para o técnico. */
export class ErroAoRestaurar extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroAoRestaurar';
  }
}

export type EtapaRestauracao =
  { etapa: 'copiando'; feitas: number; total: number } | { etapa: 'gravando' };

/** Chave do localStorage que avisa outras janelas abertas do app para recarregar. */
export const CHAVE_RESTAURADO = 'levantamento:restauradoEm';

let restaurando = false;
const ouvintes = new Set<(r: boolean) => void>();
function marcarRestaurando(r: boolean) {
  restaurando = r;
  for (const fn of ouvintes) fn(r);
}

/** Restauração em andamento: o app mostra só a tela de restaurar. */
export function useRestaurando(): boolean {
  const [r, setR] = useState(restaurando);
  useEffect(() => {
    ouvintes.add(setR);
    setR(restaurando);
    return () => void ouvintes.delete(setR);
  }, []);
  return r;
}

/** Pode restaurar agora? (nada na fila, no diário, nem foto/importação em andamento) */
export async function prontoParaRestaurar(): Promise<boolean> {
  await filaDeGravacao.descarregar();
  return (
    !restaurando &&
    filaDeGravacao.pendentes() === 0 &&
    registrosNoDiario().length === 0 &&
    !emOperacaoCritica()
  );
}

export async function restaurarBackup(
  lido: BackupLido,
  aoEtapa: (e: EtapaRestauracao) => void = () => {},
): Promise<{ copia: CopiaAntesDeRestaurar | null }> {
  if (!(await prontoParaRestaurar())) throw new ErroAoRestaurar(MENSAGEM_RESTAURAR.pendente);
  marcarRestaurando(true);
  try {
    return await comTelaAcesa(() =>
      semRecarregarDurante(async () => {
        const atual = await lerTudo();
        const esperado = impressaoDe(atual);
        const temDados =
          atual.importacoes.length +
            atual.medicoes.length +
            atual.notas.length +
            atual.fotos.length >
          0;
        let copia: CopiaAntesDeRestaurar | null = null;
        if (temDados) {
          aoEtapa({ etapa: 'copiando', feitas: 0, total: atual.fotos.length });
          const agora = new Date();
          const arquivo = await gerarBackup(atual, {
            criadoEm: agora,
            esquemaDb: VERSAO_BANCO,
            app: VERSAO_APP,
            aoProgredir: (feitas, total) => aoEtapa({ etapa: 'copiando', feitas, total }),
          });
          copia = { nome: nomeDaCopiaAutomatica(agora), criadaEm: agora.toISOString(), arquivo };
        }
        // Alguma edição chegou no meio (outra janela)? Então não restaura.
        await filaDeGravacao.descarregar();
        if (filaDeGravacao.pendentes() > 0 || registrosNoDiario().length > 0)
          throw new ErroAoRestaurar(MENSAGEM_RESTAURAR.mudou);
        aoEtapa({ etapa: 'gravando' });
        await gravarRestauracao(lido.tudo, { esperado, copia });
        try {
          localStorage.setItem(CHAVE_RESTAURADO, new Date().toISOString());
        } catch {
          // sem localStorage: a outra janela só vê os dados novos ao reabrir
        }
        return { copia };
      }),
    );
  } catch (e) {
    console.error('Restauração não feita', e);
    if (e instanceof ErroAoRestaurar) throw e;
    if (e instanceof DadosMudaramDuranteRestauracao)
      throw new ErroAoRestaurar(MENSAGEM_RESTAURAR.mudou);
    throw new ErroAoRestaurar(
      semEspaco(e) ? MENSAGEM_RESTAURAR.semEspaco : MENSAGEM_RESTAURAR.gravar,
    );
  } finally {
    marcarRestaurando(false);
  }
}
