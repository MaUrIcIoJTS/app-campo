import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import type { EquipamentoDb, ItemDb, Medicao, NotaEquipamento } from '../../src/db/esquema.ts';
import { gerarPlanilha, type DadosDaPlanilha } from '../../src/exportar/planilha.ts';
import { lerPcm } from '../../src/dominio/pcm/parser.ts';
import { registrosDoPcm } from '../../src/dominio/reimportacao.ts';

const FIXTURES = ['tests/fixtures/pcm-ficticio.xls', 'tests/fixtures/pcm-ficticio.xlsx'];

function cenario(arquivo: string) {
  const original = readFileSync(arquivo);
  const { equipamentos, itens } = registrosDoPcm(lerPcm(original), 'imp-1');
  const eq = (tag: string) => equipamentos.find((e) => e.tag === tag)!;
  const item = (tag: string, nome: string) =>
    itens.find((i) => i.equipamentoId === eq(tag).id && i.nome === nome)!;
  const tapete = item('XA-TC-01', 'TAPETE');
  const motor = item('XA-TC-01', 'MOTOR');
  const tambor = item('XA-TC-01', 'TAMBOR 1');
  const tela = item('XB-PV-01', 'TELA');
  const medicoes = new Map<string, Medicao>([
    [
      tapete.id,
      {
        itemId: tapete.id,
        valores: { largura: '660', lonas: '3', centroLd: '12450' },
        conferencia: { largura: 'confere', lonas: 'diverge', espessura: 'naoTem' },
        observacao: 'Emenda "nova" no LD',
        atualizadaEm: '2026-10-26T13:05:00.000Z',
      },
    ],
    [
      motor.id,
      {
        itemId: motor.id,
        valores: {},
        conferencia: { potencia: 'confere' },
        observacao: '',
        atualizadaEm: '2026-10-26T13:10:00.000Z',
      },
    ],
    [
      tambor.id,
      {
        itemId: tambor.id,
        valores: { diametro: '400' },
        conferencia: {},
        observacao: '',
        atualizadaEm: '2026-10-26T13:20:00.000Z',
      },
    ],
  ]);
  const notas = new Map<string, NotaEquipamento>([
    [
      eq('XA-TC-01').id,
      {
        equipamentoId: eq('XA-TC-01').id,
        observacao: 'Proteção solta',
        atualizadaEm: '2026-10-26T13:00:00.000Z',
      },
    ],
  ]);
  const fotos = [
    { alvoId: tapete.id, criadaEm: '2026-10-26T13:30:00.000Z' },
    { alvoId: tapete.id, criadaEm: '2026-10-26T13:31:00.000Z' },
    { alvoId: tela.id, criadaEm: '2026-10-26T14:00:00.000Z' },
    { alvoId: eq('XA-TC-01').id, criadaEm: '2026-10-26T12:00:00.000Z' },
  ];
  const dados: DadosDaPlanilha = {
    arquivoOriginal: original,
    equipamentos,
    itens,
    medicoes,
    notas,
    fotos,
    geradoEm: new Date('2026-10-26T15:00:00Z'),
  };
  return { original, dados, equipamentos, itens, tapete, motor, tambor, tela, eq, item };
}

/** Linhas como texto (igual ao parser) e posição das colunas do app numa aba. */
function aba(wb: XLSX.WorkBook, nome: string) {
  const ws = wb.Sheets[nome]!;
  const linhas = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true,
  });
  const cab = linhas.findIndex((l) => /^EQUIPAMENTOS PARA INSP/.test(l[0] ?? ''));
  const col = (linhas[cab] ?? []).indexOf('Medido');
  const doApp = (linha: number) => (linhas[linha] ?? []).slice(col, col + 4);
  return { ws, linhas, cab, col, doApp };
}

describe.each(FIXTURES)('PCM atualizado a partir de %s', (arquivo) => {
  it('acrescenta as 4 colunas depois da última usada, na linha de cada item', () => {
    const { dados, tapete, motor, tela } = cenario(arquivo);
    const wb = XLSX.read(gerarPlanilha(dados).bytes);
    const a1 = aba(wb, 'AREA 1');
    // 21 colunas no PCM (A–U): as do app começam na V, nas duas linhas do cabeçalho.
    expect(a1.col).toBe(21);
    expect(a1.doApp(a1.cab)).toEqual(['Medido', 'Confere/Diverge', 'Observação', 'Data']);
    expect(a1.doApp(a1.cab + 1)).toEqual(['Medido', 'Confere/Diverge', 'Observação', 'Data']);

    const [medido, conferencia, observacao, data] = a1.doApp(tapete.linha!);
    expect(medido).toBe(
      'Largura: 660 mm (Δ −0,4); Lonas: 3 un (Δ +1); Espessura total: não se aplica; Centro a centro LD: 12450 mm',
    );
    expect(conferencia).toBe('Diverge: Lonas');
    expect(observacao).toBe('Emenda "nova" no LD (2 fotos)');
    // Data = a mais recente entre a medição e as fotos (hora local).
    const d = new Date('2026-10-26T13:31:00.000Z');
    expect(data).toBe(
      `${String(d.getDate()).padStart(2, '0')}/10/2026 ${String(d.getHours()).padStart(2, '0')}:31`,
    );

    expect(a1.doApp(motor.linha!).slice(0, 2)).toEqual(['Potência: conforme PCM', 'Confere']);
    const sec = aba(wb, 'SECAGEM E CLASSIFICAÇÃO');
    expect(sec.doApp(tela.linha!).slice(0, 3)).toEqual(['', '', '1 foto']);
  });

  it('não altera nenhuma célula original preenchida', () => {
    const { dados, original } = cenario(arquivo);
    const antes = XLSX.read(original);
    const depois = XLSX.read(gerarPlanilha(dados).bytes);
    for (const nome of antes.SheetNames) {
      const a = antes.Sheets[nome]!;
      const b = depois.Sheets[nome]!;
      // (a aba SECAGEM tem 2 colunas em branco no fim: as do app ocupam essas células vazias)
      const preenchidas = Object.keys(a).filter((k) => !k.startsWith('!') && a[k]!.v !== '');
      expect(preenchidas.length).toBeGreaterThan(40);
      for (const end of preenchidas) expect([nome, end, b[end]?.v]).toEqual([nome, end, a[end]!.v]);
      expect(b['!merges']).toEqual(a['!merges']);
    }
  });

  it('importado de novo como PCM, dá exatamente os mesmos equipamentos e itens', () => {
    const { dados, original } = cenario(arquivo);
    const bytes = gerarPlanilha(dados).bytes;
    expect(lerPcm(bytes)).toEqual(lerPcm(original));
    expect(XLSX.read(bytes).SheetNames).toEqual([
      'AREA 1',
      'SECAGEM E CLASSIFICAÇÃO',
      'Resumo',
      'Fora do PCM',
    ]);
  });

  it('exportar de novo um arquivo já exportado reaproveita as colunas e refaz as abas', () => {
    const { dados, tapete } = cenario(arquivo);
    const primeira = gerarPlanilha(dados).bytes;
    const medicoes = new Map(dados.medicoes);
    medicoes.set(tapete.id, {
      ...medicoes.get(tapete.id)!,
      valores: { largura: '661' },
      conferencia: {},
    });
    const segunda = gerarPlanilha({ ...dados, arquivoOriginal: primeira, medicoes }).bytes;
    const wb = XLSX.read(segunda);
    expect(wb.SheetNames).toEqual(['AREA 1', 'SECAGEM E CLASSIFICAÇÃO', 'Resumo', 'Fora do PCM']);
    const a1 = aba(wb, 'AREA 1');
    expect(a1.col).toBe(21);
    expect(a1.linhas[a1.cab]!.filter((t) => t === 'Medido')).toHaveLength(1);
    expect(a1.doApp(tapete.linha!).slice(0, 2)).toEqual(['Largura: 661 mm (Δ +0,6)', '']);
    expect(lerPcm(segunda)).toEqual(lerPcm(dados.arquivoOriginal as Buffer));
  });

  it('abas "Resumo" e "Fora do PCM"', () => {
    const { dados, tambor, eq } = cenario(arquivo);
    const r = gerarPlanilha(dados);
    expect(r.itensForaDoPcm).toBe(1);
    expect(r.itensNoPcm).toBe(3);
    const wb = XLSX.read(r.bytes);
    const linhas = (nome: string) =>
      XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[nome]!, { header: 1, defval: '' });

    const resumo = linhas('Resumo');
    expect(String(resumo[0]![0])).toMatch(/^Gerado pelo app Levantamento PCM em /);
    expect(resumo[2]).toEqual([
      'Aba',
      'TAG',
      'Equipamento',
      '% preenchido',
      'Fotos',
      'Divergências',
      'Observação do equipamento',
    ]);
    const tc01 = resumo.find((l) => l[1] === 'XA-TC-01')!;
    expect(tc01.slice(0, 3)).toEqual(['AREA 1', 'XA-TC-01', eq('XA-TC-01').nome]);
    expect(tc01.slice(4)).toEqual([3, 1, 'Proteção solta']);
    expect(resumo).toHaveLength(3 + dados.equipamentos.length);

    const fora = linhas('Fora do PCM');
    expect(fora[2]).toEqual([
      'Aba',
      'TAG',
      'Equipamento',
      'Item',
      'Medido',
      'Confere/Diverge',
      'Observação',
      'Data',
    ]);
    expect(fora[3]!.slice(0, 5)).toEqual([
      'AREA 1',
      'XA-TC-01',
      eq('XA-TC-01').nome,
      tambor.nome,
      'Ø do tambor: 400 mm',
    ]);
  });

  it('linhas MANCAL/ROLAMENTO/BUCHA levam o que foi anotado nos tambores', () => {
    const { dados, tambor, item } = cenario(arquivo);
    const tambor2 = item('XA-TC-01', 'TAMBOR 2');
    const mancal = item('XA-TC-01', 'MANCAL');
    const elevador = item('XA-EC-01', 'TAMBOR 1');
    const medicao = (
      itemId: string,
      valores: Medicao['valores'],
      conferencia: Medicao['conferencia'],
      atualizadaEm: string,
    ): [string, Medicao] => [
      itemId,
      { itemId, valores, conferencia, observacao: '', atualizadaEm },
    ];
    const medicoes = new Map([
      ...dados.medicoes,
      medicao(
        tambor.id,
        { diametro: '400', mancal: 'SNA 515', rolamento: '22215 K' },
        { mancal: 'confere', rolamento: 'confere' },
        '2026-10-26T13:40:00.000Z',
      ),
      medicao(
        tambor2.id,
        { mancal: 'SNA 516' },
        { mancal: 'diverge', bucha: 'naoTem', rolamento: 'diverge' },
        '2026-10-26T13:45:00.000Z',
      ),
      medicao(mancal.id, { codigo: 'SNA 515' }, { codigo: 'confere' }, '2026-10-26T13:50:00.000Z'),
      medicao(elevador.id, { mancal: 'SNA 520' }, {}, '2026-10-26T14:10:00.000Z'),
    ]);
    const r = gerarPlanilha({ ...dados, medicoes });
    const wb = XLSX.read(r.bytes);
    const a1 = aba(wb, 'AREA 1');
    const hora = (iso: string) => {
      const d = new Date(iso);
      const dois = (n: number) => String(n).padStart(2, '0');
      return `${dois(d.getDate())}/10/2026 ${dois(d.getHours())}:${dois(d.getMinutes())}`;
    };

    // O que foi anotado na própria linha vem antes; um ✗ no tambor faz a linha divergir.
    expect(a1.doApp(mancal.linha!)).toEqual([
      'Código gravado: SNA 515; Nos tambores: Tambor 1: SNA 515 · Tambor 2: SNA 516',
      'Diverge: Tambor 2',
      '',
      hora('2026-10-26T13:50:00.000Z'),
    ]);
    // Linha sem medição própria sai preenchida; ✗ sem valor só aparece em Confere/Diverge.
    expect(a1.doApp(item('XA-TC-01', 'ROLAMENTO').linha!)).toEqual([
      'Nos tambores: Tambor 1: 22215 K',
      'Diverge: Tambor 2',
      '',
      hora('2026-10-26T13:45:00.000Z'),
    ]);
    // "Não tem" no tambor; a data é só a dos tambores que têm algo neste campo.
    expect(a1.doApp(item('XA-TC-01', 'BUCHA').linha!)).toEqual([
      'Nos tambores: Tambor 2: não se aplica',
      '',
      '',
      hora('2026-10-26T13:45:00.000Z'),
    ]);
    // Duas linhas de mancal no equipamento: o app não sabe qual é de qual tambor, as duas levam.
    for (const nome of ['MANCAL DE CIMA', 'MANCAL DE BAIXO'])
      expect(a1.doApp(item('XA-EC-01', nome).linha!).slice(0, 2)).toEqual([
        'Nos tambores: Tambor 1: SNA 520',
        '',
      ]);
    // Equipamento sem nada anotado nos tambores: a linha MANCAL continua vazia.
    expect(a1.doApp(item('XA-TC-02', 'MANCAL').linha!)).toEqual(['', '', '', '']);

    // Os tambores continuam inteiros em "Fora do PCM" (nada sai de lá).
    const fora = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Fora do PCM']!, {
      header: 1,
      defval: '',
    });
    expect(fora[1]![0]).toMatch(/também vão para as linhas MANCAL, ROLAMENTO e BUCHA/);
    expect(fora.slice(3).map((l) => [l[1], l[3], l[4], l[5]])).toEqual([
      [
        'XA-TC-01',
        'TAMBOR 1',
        'Ø do tambor: 400 mm; Mancal (código gravado): SNA 515; Rolamento: 22215 K',
        'Confere',
      ],
      [
        'XA-TC-01',
        'TAMBOR 2',
        'Mancal (código gravado): SNA 516; Bucha: não se aplica',
        'Diverge: Mancal (código gravado), Rolamento',
      ],
      ['XA-EC-01', 'TAMBOR 1', 'Mancal (código gravado): SNA 520', ''],
    ]);
    // tapete, motor, tela + MANCAL, ROLAMENTO e BUCHA do XA-TC-01 + as 2 do XA-EC-01
    expect(r.itensNoPcm).toBe(8);
    expect(r.itensForaDoPcm).toBe(3);
  });
});

describe('rede de segurança', () => {
  it('item cuja linha não bate com a planilha vai para "Fora do PCM", nunca para outra linha', () => {
    const { dados, tapete } = cenario(FIXTURES[0]!);
    const errado: ItemDb[] = dados.itens.map((i) =>
      i.id === tapete.id ? { ...i, linha: i.linha! + 1 } : i,
    );
    const r = gerarPlanilha({ ...dados, itens: errado });
    const wb = XLSX.read(r.bytes);
    const a1 = aba(wb, 'AREA 1');
    expect(a1.doApp(tapete.linha! + 1)).toEqual(['', '', '', '']);
    expect(r.itensForaDoPcm).toBe(2);
  });

  it('equipamento fora do PCM atual (órfão) vai inteiro para "Fora do PCM"', () => {
    const { dados, tapete } = cenario(FIXTURES[0]!);
    const equipamentos: EquipamentoDb[] = dados.equipamentos.map((e) =>
      e.id === tapete.equipamentoId ? { ...e, orfao: true } : e,
    );
    const r = gerarPlanilha({ ...dados, equipamentos });
    expect(r.itensNoPcm).toBe(1); // só a TELA (com foto), de outro equipamento
    expect(r.itensForaDoPcm).toBe(3);
  });
});

/** Formato de uma célula lido direto do XML do .xlsx (o SheetJS não lê fontes e bordas). */
interface FormatoLido {
  negrito: boolean;
  cor: string | null;
  fundo: string | null;
  borda: boolean;
  quebra: boolean;
}

async function abrirXlsx(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const texto = (caminho: string) => zip.file(caminho)!.async('string');
  const estilos = await texto('xl/styles.xml');
  const lista = (nome: string, item: string) =>
    [
      ...(
        new RegExp(`<${nome} count="\\d+">([\\s\\S]*?)</${nome}>`).exec(estilos)?.[1] ?? ''
      ).matchAll(new RegExp(`<${item}(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</${item}>)`, 'g')),
    ].map((m) => m[0]);
  const fontes = lista('fonts', 'font');
  const fundos = lista('fills', 'fill');
  const bordas = lista('borders', 'border');
  const xfs = lista('cellXfs', 'xf');
  const atributo = (xml: string, nome: string) =>
    new RegExp(`${nome}="([^"]*)"`).exec(xml)?.[1] ?? null;
  const abas = new Map<string, string>();
  const wb = XLSX.read(bytes);
  for (const [k, nome] of wb.SheetNames.entries())
    abas.set(nome, await texto(`xl/worksheets/sheet${k + 1}.xml`));

  const formato = (aba: string, end: string): FormatoLido | null => {
    const c = new RegExp(`<c r="${end}"[^>]*>`).exec(abas.get(aba)!)?.[0];
    const s = c ? atributo(c, 's') : null;
    if (!s) return null;
    const xf = xfs[Number(s)]!;
    const fonte = fontes[Number(atributo(xf, 'fontId'))]!;
    return {
      negrito: fonte.includes('<b/>'),
      cor: atributo(fonte, 'rgb'),
      fundo: atributo(fundos[Number(atributo(xf, 'fillId'))]!, 'rgb'),
      borda: bordas[Number(atributo(xf, 'borderId'))]!.includes('style="thin"'),
      quebra: xf.includes('wrapText="1"'),
    };
  };
  const congelado = (aba: string) => {
    const painel = /<pane [^>]*state="frozen"[^>]*\/>/.exec(abas.get(aba)!)?.[0];
    return painel ? Number(atributo(painel, 'ySplit')) : 0;
  };
  const altura = (aba: string, linha: number) => {
    const row = new RegExp(`<row r="${linha + 1}"[^>]*>`).exec(abas.get(aba)!)?.[0];
    return row ? Number(atributo(row, 'ht') ?? 0) : 0;
  };
  return { zip, wb, formato, congelado, altura };
}

const end = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

describe.each(FIXTURES)('aparência do PCM atualizado a partir de %s', (arquivo) => {
  it('títulos em negrito com fundo, bordas, quebra de texto, "Diverge" em vermelho', async () => {
    const { dados, tapete, motor, itens } = cenario(arquivo);
    const erro = vi.spyOn(console, 'error');
    const bytes = gerarPlanilha(dados).bytes;
    expect(erro).not.toHaveBeenCalled(); // não caiu no "sem formatação"
    erro.mockRestore();
    const x = await abrirXlsx(bytes);
    const a1 = aba(x.wb, 'AREA 1');

    // Cabeçalho do PCM (cinza) e das colunas do app (azul-claro), nas duas linhas.
    for (const r of [a1.cab, a1.cab + 1]) {
      expect(x.formato('AREA 1', end(r, 0))).toMatchObject({ negrito: true, fundo: 'FFD9D9D9' });
      for (let k = 0; k < 4; k++)
        expect(x.formato('AREA 1', end(r, a1.col + k))).toEqual({
          negrito: true,
          cor: null,
          fundo: 'FFDDEBF7',
          borda: true,
          quebra: true,
        });
    }

    // Linha do tapete: borda e quebra; "Diverge: Lonas" em vermelho e negrito.
    const medido = x.formato('AREA 1', end(tapete.linha!, a1.col));
    expect(medido).toMatchObject({ negrito: false, borda: true, quebra: true });
    expect(x.formato('AREA 1', end(tapete.linha!, a1.col + 1))).toMatchObject({
      negrito: true,
      cor: 'FFC00000',
      borda: true,
    });
    // "Confere" não fica vermelho.
    expect(x.formato('AREA 1', end(motor.linha!, a1.col + 1))).toMatchObject({
      negrito: false,
      borda: true,
    });
    // Item sem medida: as 4 células vazias têm borda (a tabela fica inteira).
    const semMedida = itens.find(
      (i) => i.equipamentoId === tapete.equipamentoId && i.origem === 'pcm' && i.nome === 'REDUTOR',
    )!;
    for (let k = 0; k < 4; k++)
      expect(x.formato('AREA 1', end(semMedida.linha!, a1.col + k))?.borda).toBe(true);
    // Texto do "Medido" quebra em várias linhas: a linha fica mais alta.
    expect(x.altura('AREA 1', tapete.linha!)).toBeGreaterThan(30);
  });

  it('cabeçalho congelado nas abas do PCM e nas do app', async () => {
    const { dados } = cenario(arquivo);
    const x = await abrirXlsx(gerarPlanilha(dados).bytes);
    const a1 = aba(x.wb, 'AREA 1');
    expect(x.congelado('AREA 1')).toBe(a1.cab + 2);
    expect(x.congelado('SECAGEM E CLASSIFICAÇÃO')).toBe(
      aba(x.wb, 'SECAGEM E CLASSIFICAÇÃO').cab + 2,
    );
    expect(x.congelado('Resumo')).toBe(3);
    expect(x.congelado('Fora do PCM')).toBe(3);
  });

  it('abas Resumo e Fora do PCM: cabeçalho, bordas e divergências em vermelho', async () => {
    const { dados } = cenario(arquivo);
    const x = await abrirXlsx(gerarPlanilha(dados).bytes);
    expect(x.formato('Resumo', 'A3')).toMatchObject({ negrito: true, fundo: 'FFDDEBF7' });
    expect(x.formato('Fora do PCM', 'H3')).toMatchObject({ negrito: true, borda: true });
    const resumo = XLSX.utils.sheet_to_json<(string | number)[]>(x.wb.Sheets.Resumo!, {
      header: 1,
    });
    const r = resumo.findIndex((l) => l[1] === 'XA-TC-01');
    expect(x.formato('Resumo', end(r, 5))).toMatchObject({ cor: 'FFC00000', borda: true });
    const r2 = resumo.findIndex((l, k) => k > 2 && Number(l[5]) === 0);
    expect(x.formato('Resumo', end(r2, 5))).toMatchObject({ cor: null, borda: true });
    expect(x.formato('Fora do PCM', 'E4')).toMatchObject({ borda: true, quebra: true });
  });

  it('o arquivo formatado tem as mesmas partes do zip e reexporta formatado de novo', async () => {
    const { dados } = cenario(arquivo);
    const primeira = gerarPlanilha(dados).bytes;
    const x = await abrirXlsx(primeira);
    expect(Object.keys(x.zip.files).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'docProps/app.xml',
        'docProps/core.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/metadata.xml',
        'xl/styles.xml',
        'xl/theme/theme1.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
        'xl/worksheets/sheet3.xml',
        'xl/worksheets/sheet4.xml',
      ].sort(),
    );
    const segunda = await abrirXlsx(gerarPlanilha({ ...dados, arquivoOriginal: primeira }).bytes);
    const a1 = aba(segunda.wb, 'AREA 1');
    expect(a1.col).toBe(21);
    expect(segunda.formato('AREA 1', end(a1.cab, a1.col))).toMatchObject({ negrito: true });
    expect(segunda.congelado('Resumo')).toBe(3);
  });
});
