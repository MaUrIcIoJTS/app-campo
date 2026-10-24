/**
 * Leitura do PCM (.xls/.xlsx) para o modelo interno.
 *
 * Layout esperado em cada aba (conferido no PCM real):
 * - cabeçalho com "EQUIPAMENTOS PARA INSPEÇÃO" na coluna A (linha 4 hoje) + 1 linha de subtítulos;
 * - depois, A = equipamento (só na 1ª linha do bloco, células mescladas), B = item,
 *   C = especificação, D = quantidade; demais colunas = serviço/periodicidade/equipe;
 * - a área de equipamentos termina na linha cuja coluna A começa com "OBSERVAÇÕES"
 *   (abaixo vêm notas, assinaturas e rodapé — ignorados).
 */
import * as XLSX from 'xlsx';
import type { AbaPcm, EquipamentoPcm, ItemPcm, Pcm } from '../tipos.ts';
import { limpar, normalizar, slug } from '../texto.ts';
import { parseNumero } from '../numeros.ts';
import { detectarTipo } from '../templates/detectar.ts';
import { extrairTag } from './tag.ts';

export type Linha = readonly unknown[];

const COL = { equipamento: 0, item: 1, especificacao: 2, quantidade: 3 } as const;
const LINHA_DADOS_PADRAO = 6;

/** Lê o arquivo (bytes do .xls/.xlsx) e devolve todas as abas. */
export function lerPcm(dados: ArrayBuffer | Uint8Array): Pcm {
  const wb = XLSX.read(dados, { type: 'array', cellDates: false, cellStyles: false });
  return {
    abas: wb.SheetNames.map((nome) => {
      const ws = wb.Sheets[nome];
      const linhas = ws
        ? XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: '',
            raw: false,
            blankrows: true,
          })
        : [];
      return parseAba(nome, linhas);
    }),
  };
}

/** Interpreta as linhas de uma aba (já convertidas em matriz de texto). */
export function parseAba(nomeAba: string, linhas: readonly Linha[]): AbaPcm {
  const avisos: string[] = [];
  const idAba = slug(nomeAba);
  const inicio = acharInicioDados(linhas);
  if (inicio === null) {
    avisos.push(
      `Cabeçalho "EQUIPAMENTOS PARA INSPEÇÃO" não encontrado; lendo a partir da linha ${LINHA_DADOS_PADRAO + 1}.`,
    );
  }

  const equipamentos: EquipamentoPcm[] = [];
  let atual: EquipamentoPcm | null = null;
  let achouFim = false;

  for (let i = inicio ?? LINHA_DADOS_PADRAO; i < linhas.length; i++) {
    const r = linhas[i] ?? [];
    const a = limpar(r[COL.equipamento]);
    const b = limpar(r[COL.item]);
    const c = limpar(r[COL.especificacao]);
    const d = limpar(r[COL.quantidade]);

    if (/^OBSERVA[CÇ][OÕ]ES\b/.test(normalizar(a))) {
      achouFim = true;
      break;
    }
    if (!a && !b && !c && !d) continue;

    if (a) {
      const { tag, nome } = extrairTag(a);
      atual = {
        id: `${idAba}:${i}`,
        aba: nomeAba,
        linha: i,
        nomeOriginal: a,
        nome,
        tag,
        itens: [],
      };
      equipamentos.push(atual);
    }
    if (!atual) {
      avisos.push(`Linha ${i + 1}: item "${b || c}" sem equipamento acima — ignorado.`);
      continue;
    }
    if (b || c || d) {
      atual.itens.push({
        id: `${atual.id}:${i}`,
        origem: 'pcm',
        linha: i,
        nome: b || '(sem descrição)',
        especificacao: c,
        quantidade: d,
        tipo: detectarTipo(b, c),
      });
    }
  }

  if (!achouFim) avisos.push('Linha "OBSERVAÇÕES" não encontrada; li até o fim da aba.');
  for (const eq of equipamentos) eq.itens.push(...deduzirTambores(eq));
  return { nome: nomeAba, equipamentos, avisos };
}

/** Primeira linha de dados: logo após o cabeçalho de 2 linhas, ou null se não achar. */
function acharInicioDados(linhas: readonly Linha[]): number | null {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    if (/^EQUIPAMENTOS? PARA INSP/.test(normalizar(linhas[i]?.[COL.equipamento]))) return i + 2;
  }
  return null;
}

/**
 * Tambores não aparecem no PCM: são deduzidos dos mancais de equipamentos com
 * tapete/correia. Cada tambor fica entre 2 mancais; mínimo de 2 (tração e retorno).
 */
export function deduzirTambores(eq: EquipamentoPcm): ItemPcm[] {
  if (!eq.itens.some((i) => i.tipo === 'tapete')) return [];
  if (eq.itens.some((i) => i.tipo === 'tambor')) return [];
  const mancais = eq.itens.filter((i) => i.tipo === 'mancal' && /^MANCAL/.test(normalizar(i.nome)));
  const totalMancais = mancais.reduce((s, i) => s + (parseNumero(i.quantidade) ?? 0), 0);
  const n = Math.max(2, Math.ceil(totalMancais / 2));
  const referencia = mancais
    .map((m) => m.especificacao)
    .filter(Boolean)
    .join(' / ');
  return Array.from({ length: n }, (_, k) => ({
    id: `${eq.id}:tambor-${k + 1}`,
    origem: 'deduzido' as const,
    linha: null,
    nome: `TAMBOR ${k + 1}`,
    especificacao: referencia,
    quantidade: '1 UNIDADE',
    tipo: 'tambor' as const,
  }));
}
