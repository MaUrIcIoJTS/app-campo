/**
 * Gera o PCM FICTÍCIO usado nos testes: tests/fixtures/pcm-ficticio.{xls,xlsx}.
 *   npm run pcm:fixture
 *
 * NÃO lê o PCM real. Todo o conteúdo é escrito aqui à mão, imitando a ESTRUTURA do real
 * (cabeçalho, mesclagem da coluna A, rodapé após "OBSERVAÇÕES") e os casos difíceis
 * encontrados nele. TAGs usam prefixos que não existem na fábrica (XA, XB, XC).
 * Ao achar um caso novo no PCM real, reproduza-o aqui com texto inventado.
 */
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';

type Bloco = { equipamento: string; itens: [item: string, espec: string, qtd: string][] };

const CABECALHO_SERVICO = [
  'VERIFICAÇÃO DE FUNCIONAMENTO',
  'LIMPEZA',
  'REAPERTO',
  'TROCA',
  'LUBRIFICAÇÃO',
  'REVISÃO',
  'BALANCEAMENTO',
];
const CABECALHO_PERIODO = ['DIÁRIA', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'SEMESTRAL', 'ANUAL'];
const CABECALHO_EQUIPE = ['EMPRESA X', 'ELÉTRICA', 'MECÂNICA', 'TERCEIROS'];

function aba(titulo: string, blocos: Bloco[], colunasExtras = 0): XLSX.WorkSheet {
  const largura =
    4 +
    CABECALHO_SERVICO.length +
    CABECALHO_PERIODO.length +
    CABECALHO_EQUIPE.length +
    colunasExtras;
  const vazia = () => Array<string>(largura).fill('');
  const linhas: string[][] = [];
  const add = (...cels: string[]) => linhas.push(Object.assign(vazia(), cels));

  add('', 'PROGRAMA DE CONTROLE E MANUTENÇÃO');
  add('', 'EQUIPAMENTO:', titulo);
  add('', 'RESPONSÁVEL:', 'FULANO DE TAL - ENCARREGADO');
  add('', 'SUPERVISÃO:', 'BELTRANO DA SILVA - SUPERVISOR');
  const h4 = vazia();
  h4[0] = 'EQUIPAMENTOS PARA INSPENÇÃO'; // grafia do original
  h4[1] = 'ITENS A INSPENCIONAR';
  h4[2] = 'ESPECIFICAÇÃO DOS ITENS DE INSPENÇÃO';
  h4[3] = 'QUANTIDADE DE ITENS';
  h4[4] = 'SERVIÇO DE MANUTENÇÃO';
  h4[4 + CABECALHO_SERVICO.length] = 'PERIODICIDADE DE VERIFICAÇÃO';
  h4[4 + CABECALHO_SERVICO.length + CABECALHO_PERIODO.length] = 'EQUIPE DE INSPENÇÃO';
  linhas.push(h4);
  add('', '', '', '', ...CABECALHO_SERVICO, ...CABECALHO_PERIODO, ...CABECALHO_EQUIPE);

  const merges: XLSX.Range[] = [];
  for (const b of blocos) {
    const inicio = linhas.length;
    b.itens.forEach(([item, espec, qtd], k) => {
      const l = vazia();
      l[0] = k === 0 ? b.equipamento : '';
      [l[1], l[2], l[3]] = [item, espec, qtd];
      if (item.startsWith('MOTOR')) [l[4], l[5]] = ['V', 'L'];
      linhas.push(l);
    });
    if (b.itens.length > 1)
      merges.push({ s: { r: inicio, c: 0 }, e: { r: linhas.length - 1, c: 0 } });
  }

  add('OBSERVAÇÕES');
  add('VERIFICAÇÃO E LIMPEZA DE MOTORES, QUINZENAL, PRIMEIRA E TERCEIRA SEMANA DO MÊS');
  add('', 'ITEM DEPOIS DO RODAPÉ', 'NÃO PODE SER LIDO', '1 UNIDADE');
  add('RESPONSÁVEL PELA INSPEÇÃO/MANUTENÇÃO');
  add('REVISÃO : 01 DATA: 01/01/2024');

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!merges'] = merges;
  return ws;
}

const area1: Bloco[] = [
  {
    equipamento: 'ILUMINAÇÃO GERAL E TOMADAS',
    itens: [
      ['PAINEL DE ILUMINAÇÃO AREA 1', 'PAINEL DE ILUMINAÇÃO +9Z0000.1', '1 UNIDADE'],
      ['REFLETORES', 'REFLETOR LED 150W', '4 UNIDADES'],
    ],
  },
  { equipamento: 'SALA DE PAINÉIS', itens: [['CCM', 'PAINEL 440V CCM +9Z0001', '1 UNIDADE']] },
  {
    equipamento: 'TRANSPORTADORA 01 - TESTE XA-TC-01',
    itens: [
      ['TAPETE', '26" 3/16 X 1/16 2 LONAS', '23 METROS'],
      ['ROLETE DE CARGA', '212x250x102x14x20', '39 UNIDADES'],
      ['ROLETE DE RETORNO', '672X702X100X20X14', '6 UNIDADES'], // ordem invertida D/E
      ['REDUTOR', 'REDUTOR COROA E ROSCA SEM FIM 1:30 EIXO VAZADO SERIE: 0000000001', '1 UNIDADE'],
      ['MOTOR ', '5CV 1730RPM', '1 UNIDADE'], // espaço sobrando, como no real
      ['MANCAL', 'SNA 515 EIXO 63', '4 UNIDADES'],
      ['ROLAMENTO', 'ROLAMENTO AUTOCOMP. ROLOS 22215 K', '4 UNIDADES'],
      ['BUCHA', 'HE 315', '4 UNIDADES'],
      ['POLIA DO MOTOR', '100 2 GORNES B', '1 UNIDADE'],
      ['CORREIA EM V', 'B 50', '2 UNIDADES'],
      ['CHAVE DE SEGURANÇA', 'CHAVE EMERGENCIA MODELO X', '2 UNIDADES'],
    ],
  },
  {
    equipamento: 'TRANSPORTADORA 02 - GRANDE XA-TC-02',
    itens: [
      ['CORREIA', 'CORREIA TRANSPORTADORA 30" 2 LONAS (10MM)', '40 METROS'], // "CORREIA" = tapete
      ['ROLETE DE CARGA/EMBURRACHADO', '260x300X100X20X14', '66 UNIDADES'],
      ['MANCAL', 'SNA 517 EIXO 75MM', '10 UNIDADES'], // 10 mancais → 5 tambores
      ['MOTORREDUTOR', 'GD60 1:37,38 10CV 4P', '1 UNIDADE'],
      ['CORREIA', 'C165', '2 UNIDADES'], // "CORREIA" = correia em V
    ],
  },
  {
    equipamento: 'ELEVADOR DE CANECAS          XA-EC-01 (ELEV-01) - LEVA CAL P/ SILO',
    itens: [
      ['CORREIA', 'CORREIA ELEVADORA EP1000/4 12" 1/4 X 1/8"', '54 METROS'],
      ['CANECOS', '155X260X190MM (AXLXP)', '100 UNIDADES'],
      ['MANCAL DE CIMA', 'SNA 520 MB (ø90 EIXO)', '2 UNIDADES'],
      ['MANCAL DE BAIXO', 'F211 (ø55 EIXO)', '2 UNIDADES'],
      ['ROTOR', '', ''], // vazio, como no real
    ],
  },
];

const area2: Bloco[] = [
  { equipamento: 'SALA DE PAINÉIS', itens: [['PLC', 'PAINEL PLC +9Z0002', '1 UNIDADE']] }, // mesmo nome da aba 1
  {
    equipamento: 'PENEIRA VIBRATÓRIA - XB-PV-01',
    itens: [
      ['TELA', 'TELA MALHA 30MM FIO 9MM 2400X1200', '1 UNIDADE'],
      ['MOTOR', '2 CV 1750RPM', '1 UNIDADE'],
      ['ACOPLAMENTO', 'BORRACHA 120MM', '2 UNIDADES'],
      ['CABO DE AÇO', '1/2 6X19 AF', '6 METROS'],
      ['GRELHAS', 'INDEFINIDO', '?'],
    ],
  },
  // Bloco de uma linha só, sem coluna B (existe no real).
  { equipamento: 'VALVULA PENDULAR - DESCARGA - XB-VV-04', itens: [['', '', '1 UNIDADE']] },
  {
    equipamento: 'UNIDADE HIDRÁULICA XB-UH-01',
    itens: [
      ['PISTÃO DA UNID. HIDRÁULICA', 'CILINDRO 63X400', '1 UNIDADE'],
      ['TERMOPAR XB-TE-01', 'TERMOPAR TIPO K', '1 UNIDADE'],
    ],
  },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aba('AREA 1', area1), 'AREA 1');
XLSX.utils.book_append_sheet(
  wb,
  aba('SECAGEM E CLASSIFICAÇÃO', area2, 2),
  'SECAGEM E CLASSIFICAÇÃO',
);

mkdirSync('tests/fixtures', { recursive: true });
for (const [arquivo, bookType] of [
  ['tests/fixtures/pcm-ficticio.xls', 'biff8'],
  ['tests/fixtures/pcm-ficticio.xlsx', 'xlsx'],
] as const) {
  writeFileSync(arquivo, XLSX.write(wb, { type: 'buffer', bookType }));
}
console.log('Gerado: tests/fixtures/pcm-ficticio.xls e .xlsx');
