/**
 * PCM atualizado (.xlsx) a partir do ARQUIVO ORIGINAL guardado na importação: mesmas abas,
 * textos, mesclagens, larguras e alturas; nas abas do PCM, 4 colunas novas na linha de cada
 * item; abas novas "Resumo" e "Fora do PCM". As colunas originais nunca são alteradas.
 *
 * O arquivo gerado é um PCM válido para o próprio app: importado de novo, dá os mesmos
 * equipamentos e itens (ver `dominio/pcm/exportado.ts`). Carregar com `import()`: SheetJS é
 * pesado (já está no cache offline).
 *
 * Limitação conhecida: a versão gratuita do SheetJS não grava fontes, bordas nem cores.
 */
import * as XLSX from 'xlsx';
import type { EquipamentoDb, ItemDb, Medicao, NotaEquipamento } from '../db/esquema.ts';
import {
  ABA_FORA_DO_PCM,
  ABA_RESUMO,
  COLUNAS_DO_APP,
  MARCA_ABA_DO_APP,
} from '../dominio/pcm/exportado.ts';
import { abaDoApp, linhaDoCabecalho, linhasDaAba } from '../dominio/pcm/parser.ts';
import { percentual, progressoItem, somarProgresso } from '../dominio/progresso.ts';
import { limpar, normalizar } from '../dominio/texto.ts';
import { dataHora, maisRecente, textoConferencia, textoMedido, textoObservacao } from './textos.ts';

export interface DadosDaPlanilha {
  /** Bytes do arquivo do PCM como foi importado. */
  arquivoOriginal: ArrayBuffer | Uint8Array;
  equipamentos: readonly EquipamentoDb[];
  itens: readonly ItemDb[];
  medicoes: ReadonlyMap<string, Medicao>;
  notas: ReadonlyMap<string, NotaEquipamento>;
  /** Só o necessário das fotos (sem os blobs). */
  fotos: readonly { alvoId: string; criadaEm: string }[];
  geradoEm: Date;
}

export interface ResultadoPlanilha {
  bytes: Uint8Array;
  /** Itens com dado escritos nas abas do PCM e na aba "Fora do PCM". */
  itensNoPcm: number;
  itensForaDoPcm: number;
}

/** Larguras (em caracteres) das 4 colunas novas. */
const LARGURAS = [60, 24, 40, 17];
/** Se a aba não tiver o cabeçalho, o parser lê a partir da linha 7; o título vai na 5. */
const CABECALHO_PADRAO = 4;

const celula = (v: string | number): XLSX.CellObject =>
  typeof v === 'number' ? { t: 'n', v } : { t: 's', v };

function removerAba(wb: XLSX.WorkBook, nome: string): void {
  const k = wb.SheetNames.indexOf(nome);
  if (k < 0) return;
  wb.SheetNames.splice(k, 1);
  wb.Workbook?.Sheets?.splice(k, 1);
  delete wb.Sheets[nome];
}

/** Última coluna com valor ou mesclagem na aba (as abas não têm todas a mesma largura). */
function ultimaColunaUsada(ws: XLSX.WorkSheet): number {
  let ultima = -1;
  for (const [end, cel] of Object.entries(ws)) {
    if (end.startsWith('!')) continue;
    const v = (cel as XLSX.CellObject).v;
    if (v === undefined || v === null || String(v).trim() === '') continue;
    ultima = Math.max(ultima, XLSX.utils.decode_cell(end).c);
  }
  for (const m of ws['!merges'] ?? []) ultima = Math.max(ultima, m.e.c);
  return ultima;
}

/** Coluna onde começam as 4 colunas do app numa exportação anterior (reimportada), ou null. */
function colunasJaExportadas(ws: XLSX.WorkSheet, linha: number, ate: number): number | null {
  const texto = (r: number, c: number) => limpar(ws[XLSX.utils.encode_cell({ r, c })]?.v);
  for (let c = 0; c <= ate; c++) {
    if (COLUNAS_DO_APP.every((titulo, k) => texto(linha, c + k) === titulo)) return c;
  }
  return null;
}

interface Linha {
  aba: string;
  eq: EquipamentoDb;
  item: ItemDb;
}

export function gerarPlanilha(d: DadosDaPlanilha): ResultadoPlanilha {
  const wb = XLSX.read(d.arquivoOriginal, {
    type: 'array',
    cellStyles: true, // larguras de coluna e alturas de linha
    cellNF: true, // formato de número: o texto lido de volta fica igual ao original
    cellDates: false,
  });
  // Abas "Resumo"/"Fora do PCM" de uma exportação anterior: são refeitas.
  for (const nome of [...wb.SheetNames]) {
    const ws = wb.Sheets[nome];
    if (ws && abaDoApp(linhasDaAba(ws))) removerAba(wb, nome);
  }

  const fotosPorAlvo = new Map<string, string[]>();
  for (const f of d.fotos) {
    const lista = fotosPorAlvo.get(f.alvoId) ?? [];
    lista.push(f.criadaEm);
    fotosPorAlvo.set(f.alvoId, lista);
  }
  const temDado = (id: string) => d.medicoes.has(id) || fotosPorAlvo.has(id);
  const colunas = (item: ItemDb) => {
    const m = d.medicoes.get(item.id);
    const fotos = fotosPorAlvo.get(item.id) ?? [];
    return [
      textoMedido(item, m),
      textoConferencia(item, m),
      textoObservacao(m?.observacao, fotos.length),
      dataHora(maisRecente([m?.atualizadaEm, ...fotos])),
    ];
  };

  const eqPorId = new Map(d.equipamentos.map((e) => [e.id, e]));
  const porAba = new Map<string, Linha[]>();
  const foraDoPcm: Linha[] = [];
  for (const item of d.itens) {
    const eq = eqPorId.get(item.equipamentoId);
    if (!eq || !temDado(item.id)) continue;
    const linha = { aba: eq.aba, eq, item };
    const noPcm =
      item.origem === 'pcm' && item.linha !== null && !item.orfao && !eq.orfao && wb.Sheets[eq.aba];
    if (!noPcm) {
      foraDoPcm.push(linha);
      continue;
    }
    const lista = porAba.get(eq.aba) ?? [];
    lista.push(linha);
    porAba.set(eq.aba, lista);
  }

  let itensNoPcm = 0;
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws?.['!ref']) continue;
    const linhas = linhasDaAba(ws);
    const inicio = XLSX.utils.decode_range(ws['!ref']).s;
    const cab = inicio.r + (linhaDoCabecalho(linhas) ?? CABECALHO_PADRAO);
    const limite = Math.max(ultimaColunaUsada(ws), inicio.c);
    const jaExportadas = colunasJaExportadas(ws, cab, limite);
    const col0 = jaExportadas ?? limite + 1;
    if (jaExportadas !== null) {
      // Limpa os valores da exportação anterior (abaixo dos títulos).
      for (const end of Object.keys(ws)) {
        if (end.startsWith('!')) continue;
        const { r, c } = XLSX.utils.decode_cell(end);
        if (r > cab + 1 && c >= col0 && c < col0 + COLUNAS_DO_APP.length) delete ws[end];
      }
    }
    const escrever = (r: number, valores: readonly string[]) =>
      valores.forEach((v, k) => {
        if (v) ws[XLSX.utils.encode_cell({ r, c: col0 + k })] = celula(v);
      });
    escrever(cab, COLUNAS_DO_APP);
    escrever(cab + 1, COLUNAS_DO_APP);

    for (const l of porAba.get(nome) ?? []) {
      const { item } = l;
      // Rede de segurança: só escreve se a linha da planilha é mesmo deste item.
      const naPlanilha = normalizar(linhas[item.linha!]?.[1]) || normalizar('(sem descrição)');
      if (naPlanilha !== normalizar(item.nome)) {
        foraDoPcm.push(l);
        continue;
      }
      escrever(inicio.r + item.linha!, colunas(item));
      itensNoPcm++;
    }

    const cols = ws['!cols'] ?? [];
    LARGURAS.forEach((wch, k) => (cols[col0 + k] = { wch }));
    ws['!cols'] = cols;
    const range = XLSX.utils.decode_range(ws['!ref']);
    range.e.c = Math.max(range.e.c, col0 + COLUNAS_DO_APP.length - 1);
    range.e.r = Math.max(range.e.r, cab + 1);
    ws['!ref'] = XLSX.utils.encode_range(range);
  }

  const marca = `${MARCA_ABA_DO_APP} em ${dataHora(d.geradoEm.toISOString())}. Não faz parte do PCM.`;
  const nomeLivre = (nome: string) => (wb.SheetNames.includes(nome) ? `${nome} (app)` : nome);

  // Resumo por equipamento, na ordem da lista.
  const itensPorEq = new Map<string, ItemDb[]>();
  for (const i of d.itens) {
    const lista = itensPorEq.get(i.equipamentoId) ?? [];
    lista.push(i);
    itensPorEq.set(i.equipamentoId, lista);
  }
  const resumo: (string | number)[][] = [
    [marca],
    [],
    [
      'Aba',
      'TAG',
      'Equipamento',
      '% preenchido',
      'Fotos',
      'Divergências',
      'Observação do equipamento',
    ],
  ];
  for (const eq of [...d.equipamentos].sort((a, b) => a.ordem - b.ordem)) {
    const itens = itensPorEq.get(eq.id) ?? [];
    const p = somarProgresso(itens.map((i) => progressoItem(i, d.medicoes.get(i.id))));
    const fotos = [eq.id, ...itens.map((i) => i.id)].reduce(
      (s, id) => s + (fotosPorAlvo.get(id)?.length ?? 0),
      0,
    );
    resumo.push([
      eq.aba,
      eq.tag ?? '',
      eq.orfao ? `${eq.nome} (fora do PCM atual)` : eq.nome,
      percentual(p),
      fotos,
      p.divergencias,
      textoObservacao(d.notas.get(eq.id)?.observacao, 0),
    ]);
  }
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo['!cols'] = [18, 14, 40, 13, 8, 13, 50].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsResumo, nomeLivre(ABA_RESUMO));

  const ordem = (l: Linha) => [l.eq.ordem, l.item.ordem] as const;
  foraDoPcm.sort((a, b) => ordem(a)[0] - ordem(b)[0] || ordem(a)[1] - ordem(b)[1]);
  const fora: string[][] = [
    [marca],
    ['Itens medidos que não estão nas linhas do PCM (tambores e itens que saíram do PCM).'],
    ['Aba', 'TAG', 'Equipamento', 'Item', ...COLUNAS_DO_APP],
  ];
  for (const { aba, eq, item } of foraDoPcm)
    fora.push([aba, eq.tag ?? '', eq.nome, item.nome, ...colunas(item)]);
  const wsFora = XLSX.utils.aoa_to_sheet(fora);
  wsFora['!cols'] = [18, 14, 40, 30, ...LARGURAS].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsFora, nomeLivre(ABA_FORA_DO_PCM));

  const saida = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true });
  return {
    bytes: new Uint8Array(saida as ArrayBuffer),
    itensNoPcm,
    itensForaDoPcm: foraDoPcm.length,
  };
}
