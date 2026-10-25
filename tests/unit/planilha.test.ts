import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
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
  return { original, dados, equipamentos, itens, tapete, motor, tambor, tela, eq };
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
