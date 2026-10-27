/**
 * PCM atualizado (.xlsx) a partir do ARQUIVO ORIGINAL guardado na importação: mesmas abas,
 * textos, mesclagens, larguras e alturas; nas abas do PCM, 4 colunas novas na linha de cada
 * item; abas novas "Resumo" e "Fora do PCM". As colunas originais nunca são alteradas.
 *
 * O arquivo gerado é um PCM válido para o próprio app: importado de novo, dá os mesmos
 * equipamentos e itens (ver `dominio/pcm/exportado.ts`). Carregar com `import()`: SheetJS é
 * pesado (já está no cache offline).
 *
 * Aparência (negrito, bordas, cores, quebra de texto, cabeçalho congelado): `formatoPlanilha.ts`,
 * aplicada depois que o SheetJS grava o arquivo.
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
import {
  ALTURA_DA_LINHA,
  formatarXlsx,
  linhasDoTexto,
  novoFormato,
  type Estilo,
  type FormatoDaAba,
} from './formatoPlanilha.ts';
import {
  dataHora,
  maisRecente,
  nosTambores,
  textoConferencia,
  textoMedido,
  textoObservacao,
  type NosTambores,
} from './textos.ts';

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

/** Larguras (em caracteres) das 4 colunas novas; o texto quebra dentro delas. */
const LARGURAS = [55, 22, 35, 18];
/** Se a aba não tiver o cabeçalho, o parser lê a partir da linha 7; o título vai na 5. */
const CABECALHO_PADRAO = 4;
/** Congela o cabeçalho só se ele estiver perto do topo (senão sobraria pouca tela para rolar). */
const MAX_LINHAS_CONGELADAS = 10;

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

const ehDiverge = (texto: unknown) => String(texto ?? '').startsWith('Diverge');

/** Marca a célula com um estilo. Célula vazia vira célula sem valor, só para a borda aparecer. */
function marcar(ws: XLSX.WorkSheet, formato: FormatoDaAba, r: number, c: number, estilo: Estilo) {
  const end = XLSX.utils.encode_cell({ r, c });
  if (!ws[end]) ws[end] = { t: 'z', z: 'General' } as XLSX.CellObject;
  formato.celulas.set(end, estilo);
}

/** Linha mais alta quando algum texto quebra em várias linhas (nunca mais baixa que antes). */
function ajustarAltura(
  ws: XLSX.WorkSheet,
  r: number,
  valores: readonly unknown[],
  larguras: readonly number[],
) {
  const linhas = Math.max(
    1,
    ...valores.map((v, k) => (v === '' || v == null ? 1 : linhasDoTexto(String(v), larguras[k]!))),
  );
  if (linhas <= 1) return;
  const rows = (ws['!rows'] ??= []);
  const atual = rows[r]?.hpt ?? (rows[r]?.hpx ? rows[r].hpx * 0.75 : 15);
  rows[r] = { ...rows[r], hpx: undefined, hpt: Math.max(atual, linhas * ALTURA_DA_LINHA + 2) };
}

/** Aba montada pelo app (Resumo, Fora do PCM): notas no topo, cabeçalho e tabela com bordas. */
function formatarAbaDoApp(
  ws: XLSX.WorkSheet,
  linhas: readonly (readonly (string | number)[])[],
  cabecalho: number,
  larguras: readonly number[],
  alerta: (linha: readonly (string | number)[]) => number | null,
): FormatoDaAba {
  const formato = novoFormato(cabecalho + 1);
  for (let r = 0; r < cabecalho; r++) if (linhas[r]?.length) marcar(ws, formato, r, 0, 'nota');
  const colunas = linhas[cabecalho]!.length;
  for (let c = 0; c < colunas; c++) marcar(ws, formato, cabecalho, c, 'tituloApp');
  for (let r = cabecalho + 1; r < linhas.length; r++) {
    const linha = linhas[r]!;
    const vermelha = alerta(linha);
    for (let c = 0; c < colunas; c++)
      marcar(ws, formato, r, c, c === vermelha ? 'alerta' : 'celula');
    ajustarAltura(ws, r, linha, larguras);
  }
  return formato;
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
  const itensPorEq = new Map<string, ItemDb[]>();
  for (const i of d.itens) {
    const lista = itensPorEq.get(i.equipamentoId) ?? [];
    lista.push(i);
    itensPorEq.set(i.equipamentoId, lista);
  }
  // Linhas MANCAL/ROLAMENTO/BUCHA: o que foi anotado nos tambores do mesmo equipamento.
  const dosTambores = new Map<string, NosTambores>();
  for (const itens of itensPorEq.values()) {
    const tambores = itens.filter((i) => i.tipo === 'tambor').sort((a, b) => a.ordem - b.ordem);
    if (tambores.length === 0) continue;
    for (const linha of itens) {
      const t = nosTambores(linha, tambores, d.medicoes);
      if (t) dosTambores.set(linha.id, t);
    }
  }
  const temDado = (id: string) => d.medicoes.has(id) || fotosPorAlvo.has(id) || dosTambores.has(id);
  const colunas = (item: ItemDb) => {
    const m = d.medicoes.get(item.id);
    const fotos = fotosPorAlvo.get(item.id) ?? [];
    const tambores = dosTambores.get(item.id) ?? null;
    return [
      textoMedido(item, m, tambores),
      textoConferencia(item, m, tambores),
      textoObservacao(m?.observacao, fotos.length),
      dataHora(maisRecente([m?.atualizadaEm, ...fotos, tambores?.atualizadaEm])),
    ];
  };

  const eqPorId = new Map(d.equipamentos.map((e) => [e.id, e]));
  const porAba = new Map<string, Linha[]>();
  const foraDoPcm: Linha[] = [];
  /** Última linha de item do PCM em cada aba: até ela, as colunas novas ganham borda. */
  const ultimaLinha = new Map<string, number>();
  for (const item of d.itens) {
    const eq = eqPorId.get(item.equipamentoId);
    if (eq && item.origem === 'pcm' && item.linha !== null)
      ultimaLinha.set(eq.aba, Math.max(ultimaLinha.get(eq.aba) ?? 0, item.linha));
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
  const formatos = new Map<string, FormatoDaAba>();
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

    // Aparência: cabeçalho do PCM em cinza, o das colunas do app em azul-claro, bordas até o
    // último item da aba; congela o cabeçalho.
    const formato = novoFormato(cab + 2 <= MAX_LINHAS_CONGELADAS ? cab + 2 : 0);
    formatos.set(nome, formato);
    for (const r of [cab, cab + 1]) {
      for (let c = inicio.c; c < col0; c++) marcar(ws, formato, r, c, 'titulo');
      for (let k = 0; k < COLUNAS_DO_APP.length; k++) marcar(ws, formato, r, col0 + k, 'tituloApp');
    }
    const fim = ultimaLinha.has(nome) ? inicio.r + ultimaLinha.get(nome)! : cab + 1;
    for (let r = cab + 2; r <= fim; r++)
      for (let k = 0; k < COLUNAS_DO_APP.length; k++) marcar(ws, formato, r, col0 + k, 'celula');

    for (const l of porAba.get(nome) ?? []) {
      const { item } = l;
      // Rede de segurança: só escreve se a linha da planilha é mesmo deste item.
      const naPlanilha = normalizar(linhas[item.linha!]?.[1]) || normalizar('(sem descrição)');
      if (naPlanilha !== normalizar(item.nome)) {
        foraDoPcm.push(l);
        continue;
      }
      const r = inicio.r + item.linha!;
      const valores = colunas(item);
      escrever(r, valores);
      if (ehDiverge(valores[1])) marcar(ws, formato, r, col0 + 1, 'alerta');
      ajustarAltura(ws, r, valores, LARGURAS);
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
  const largurasResumo = [18, 14, 40, 13, 8, 13, 50];
  wsResumo['!cols'] = largurasResumo.map((wch) => ({ wch }));
  const nomeResumo = nomeLivre(ABA_RESUMO);
  XLSX.utils.book_append_sheet(wb, wsResumo, nomeResumo);
  // Divergências > 0 em vermelho.
  formatos.set(
    nomeResumo,
    formatarAbaDoApp(wsResumo, resumo, 2, largurasResumo, (l) => (Number(l[5]) > 0 ? 5 : null)),
  );

  const ordem = (l: Linha) => [l.eq.ordem, l.item.ordem] as const;
  foraDoPcm.sort((a, b) => ordem(a)[0] - ordem(b)[0] || ordem(a)[1] - ordem(b)[1]);
  const fora: string[][] = [
    [marca],
    [
      'Itens medidos que não estão nas linhas do PCM (tambores, medidas externas e itens que ' +
        'saíram do PCM). ' +
        'O mancal, o rolamento e a bucha dos tambores também vão para as linhas MANCAL, ' +
        'ROLAMENTO e BUCHA do PCM.',
    ],
    ['Aba', 'TAG', 'Equipamento', 'Item', ...COLUNAS_DO_APP],
  ];
  for (const { aba, eq, item } of foraDoPcm)
    fora.push([aba, eq.tag ?? '', eq.nome, item.nome, ...colunas(item)]);
  const wsFora = XLSX.utils.aoa_to_sheet(fora);
  const largurasFora = [18, 14, 40, 30, ...LARGURAS];
  wsFora['!cols'] = largurasFora.map((wch) => ({ wch }));
  const nomeFora = nomeLivre(ABA_FORA_DO_PCM);
  XLSX.utils.book_append_sheet(wb, wsFora, nomeFora);
  formatos.set(
    nomeFora,
    formatarAbaDoApp(wsFora, fora, 2, largurasFora, (l) => (ehDiverge(l[5]) ? 5 : null)),
  );

  const saida = new Uint8Array(
    XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer,
  );
  let bytes: Uint8Array = saida;
  try {
    bytes = formatarXlsx(
      saida,
      wb.SheetNames.map((n) => formatos.get(n)),
    );
  } catch (e) {
    // A aparência nunca impede a exportação: sai a planilha sem formato.
    console.error('Planilha sem formatação', e);
  }
  return { bytes, itensNoPcm, itensForaDoPcm: foraDoPcm.length };
}
