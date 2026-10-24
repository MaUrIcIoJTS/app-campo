import type { TipoItem } from '../tipos.ts';
import { normalizar } from '../texto.ts';

/**
 * Regras de detecção do tipo de item, em ordem de prioridade (a primeira que casar vence).
 * `nome` = coluna B, `espec` = coluna C, ambos normalizados (maiúsculas, sem acento).
 * Calibradas contra o PCM real — ver skill `novo-tipo-de-item` antes de mudar.
 */
const REGRAS: ReadonlyArray<{ tipo: TipoItem; casa: (nome: string, espec: string) => boolean }> = [
  { tipo: 'rolete', casa: (n) => /^ROLETE/.test(n) },
  { tipo: 'tambor', casa: (n) => /^(TAMBOR|ROLO)\b/.test(n) },
  { tipo: 'tapete', casa: (n) => /^(TAPETE|CORREIA (TRANSPORTADORA|ELEVADORA))/.test(n) },
  // "CORREIA" sozinha é ambígua no PCM: decide pela especificação.
  {
    tipo: 'tapete',
    casa: (n, e) =>
      /^CORREIA\b/.test(n) && /TRANSPORTADORA|ELEVADORA|LONAS|\d\s*"|\bEP\s?\d/.test(e),
  },
  { tipo: 'correia-v', casa: (n) => /^CORREIA\b/.test(n) },
  { tipo: 'redutor', casa: (n) => /^(MOTORR?EDUTOR|REDUTORA?)\b/.test(n) },
  { tipo: 'motor', casa: (n) => /^MOTO(R|FREIO|BOMBA)\b/.test(n) },
  { tipo: 'polia', casa: (n) => /^POLIA/.test(n) },
  { tipo: 'acoplamento', casa: (n) => /^(ACOPLAMENTO|CARDAN)\b/.test(n) },
  { tipo: 'mancal', casa: (n) => /^(MANCAL|ROLAMENTOS?|BUCHA|CAIXA DE ROLAMENTO)\b/.test(n) },
  { tipo: 'tela', casa: (n) => /^(TELA|PENEIRA)\b/.test(n) },
  { tipo: 'cabo-aco', casa: (n) => /^CABO DE ACO/.test(n) },
  { tipo: 'canecas', casa: (n) => /^CANEC(A|O)S?\b/.test(n) },
  { tipo: 'hidraulico', casa: (n) => /HIDRAULIC|^PISTAO|^CILINDRO/.test(n) },
  {
    tipo: 'sensor',
    casa: (n) =>
      /^(SENSOR|TERMOPAR|TRANSMISSOR|CELULA DE CARGA|PENDENTE|CHAVE (DE SEGURANCA|DE DESALINHAMENTO|FIM DE CURSO))/.test(
        n,
      ),
  },
  {
    tipo: 'painel',
    casa: (n) =>
      /^(PAINEL|CCM|PLC|INVERSOR|SEQUENCIADOR|CAIXA DE JUNCAO|COMPUTADOR|MONITOR)\b/.test(n),
  },
  { tipo: 'iluminacao', casa: (n) => /ILUMINACAO|^REFLETOR|LAMPADA/.test(n) },
];

export function detectarTipo(nome: string, especificacao = ''): TipoItem {
  const n = normalizar(nome);
  const e = normalizar(especificacao);
  return REGRAS.find((r) => r.casa(n, e))?.tipo ?? 'generico';
}
