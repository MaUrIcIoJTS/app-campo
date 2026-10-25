import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Medicao } from '../../src/db/esquema.ts';
import type { ItemPcm } from '../../src/dominio/tipos.ts';
import {
  carimboDeArquivo,
  nomeDaCopiaAutomatica,
  nomeDaPlanilha,
  nomeDoBackup,
  nomeDoZip,
  nomesDasFotos,
  parteDoNome,
} from '../../src/exportar/nomes.ts';
import {
  dataHora,
  haQuantoTempo,
  isoLocal,
  maisRecente,
  textoConferencia,
  textoMedido,
  textoObservacao,
} from '../../src/exportar/textos.ts';
import { crc32, gerarZip } from '../../src/exportar/zip.ts';

const tapete: ItemPcm = {
  id: 'a:6:9',
  origem: 'pcm',
  linha: 9,
  nome: 'TAPETE',
  especificacao: '26" 3/16 X 1/16 2 LONAS',
  quantidade: '23 METROS',
  tipo: 'tapete',
};

const med = (m: Partial<Medicao>): Medicao => ({
  itemId: tapete.id,
  valores: {},
  conferencia: {},
  observacao: '',
  atualizadaEm: '2026-10-26T13:05:00.000Z',
  ...m,
});

describe('coluna Medido', () => {
  it('rótulo: valor unidade (Δ), como o técnico digitou, na ordem da ficha', () => {
    const m = med({ valores: { lonas: '2', largura: '660,0', centroLd: '12450' } });
    expect(textoMedido(tapete, m)).toBe(
      'Largura: 660,0 mm (Δ −0,4); Lonas: 2 un (Δ 0); Centro a centro LD: 12450 mm',
    );
  });

  it('"Não tem" sai como "não se aplica"; ✓ sem valor, como "conforme PCM"', () => {
    const m = med({ conferencia: { espessura: 'naoTem', lonas: 'confere', largura: 'diverge' } });
    expect(textoMedido(tapete, m)).toBe('Lonas: conforme PCM; Espessura total: não se aplica');
  });

  it('valor de um campo que não existe mais no template também sai', () => {
    expect(textoMedido(tapete, med({ valores: { antigo: '12' } }))).toBe('antigo: 12');
  });

  it('sem medição: vazio', () => {
    expect(textoMedido(tapete, undefined)).toBe('');
    expect(textoMedido(tapete, med({ valores: { largura: '  ' } }))).toBe('');
  });
});

describe('coluna Confere/Diverge', () => {
  it('lista os divergentes pelo rótulo, na ordem da ficha', () => {
    const m = med({
      conferencia: { lonas: 'diverge', largura: 'diverge', comprimento: 'confere' },
    });
    expect(textoConferencia(tapete, m)).toBe('Diverge: Largura, Lonas');
  });

  it('só ✓ → Confere; "Não tem" não conta como confere nem diverge', () => {
    expect(textoConferencia(tapete, med({ conferencia: { largura: 'confere' } }))).toBe('Confere');
    expect(textoConferencia(tapete, med({ conferencia: { espessura: 'naoTem' } }))).toBe('');
    expect(
      textoConferencia(tapete, med({ conferencia: { espessura: 'naoTem', largura: 'confere' } })),
    ).toBe('Confere');
    expect(textoConferencia(tapete, med({}))).toBe('');
  });
});

describe('Observação, Data e tempo', () => {
  it('observação + fotos', () => {
    expect(textoObservacao('Emenda solta', 2)).toBe('Emenda solta (2 fotos)');
    expect(textoObservacao('', 1)).toBe('1 foto');
    expect(textoObservacao(' Ok ', 0)).toBe('Ok');
    expect(textoObservacao(undefined, 0)).toBe('');
  });

  it('dd/mm/aaaa hh:mm na hora local', () => {
    const d = new Date(2026, 9, 26, 7, 5);
    expect(dataHora(d.toISOString())).toBe('26/10/2026 07:05');
    expect(dataHora(undefined)).toBe('');
    expect(dataHora('lixo')).toBe('');
    expect(maisRecente([undefined, '2026-10-26T10:00Z', '2026-10-26T11:00Z'])).toBe(
      '2026-10-26T11:00Z',
    );
  });

  it('"há quanto tempo"', () => {
    const agora = Date.parse('2026-10-26T15:00:00Z');
    expect(haQuantoTempo('2026-10-26T14:59:30Z', agora)).toBe('agora há pouco');
    expect(haQuantoTempo('2026-10-26T14:55:00Z', agora)).toBe('há 5 min');
    expect(haQuantoTempo('2026-10-26T13:00:00Z', agora)).toBe('há 2 h');
    expect(haQuantoTempo('2026-10-25T14:00:00Z', agora)).toBe('há 1 dia');
    expect(haQuantoTempo('2026-10-22T15:00:00Z', agora)).toBe('há 4 dias');
  });

  it('ISO com o fuso do aparelho', () => {
    const d = new Date(2026, 9, 26, 14, 30, 5);
    const iso = isoLocal(d);
    expect(iso).toMatch(/^2026-10-26T14:30:05[+-]\d\d:\d\d$/);
    expect(Date.parse(iso)).toBe(d.getTime());
  });
});

describe('nomes de arquivo', () => {
  const d = new Date(2026, 9, 26, 9, 5);
  it('com data e hora local', () => {
    expect(carimboDeArquivo(d)).toBe('2026-10-26-0905');
    expect(nomeDaPlanilha(d)).toBe('pcm-atualizado-2026-10-26-0905.xlsx');
    expect(nomeDoBackup(d)).toBe('levantamento-backup-2026-10-26-0905.json');
    expect(nomeDaCopiaAutomatica(d)).toBe(
      'levantamento-backup-antes-de-restaurar-2026-10-26-0905.json',
    );
    expect(nomeDoZip(d)).toBe('fotos-2026-10-26-0905.zip');
  });

  it('só A–Z 0–9 e -, sem acento', () => {
    expect(parteDoNome('Rolete de carga/emborrachado')).toBe('ROLETE-DE-CARGA-EMBORRACHADO');
    expect(parteDoNome('PISTÃO DA UNID. HIDRÁULICA')).toBe('PISTAO-DA-UNID-HIDRAULICA');
    expect(parteDoNome('ILUMINAÇÃO GERAL E TOMADAS DA ÁREA 1')).toBe(
      'ILUMINACAO-GERAL-E-TOMADAS-DA',
    );
    expect(parteDoNome('ILUMINAÇÃO GERAL E TOMADAS DA ÁREA 1').length).toBeLessThanOrEqual(30);
    expect(parteDoNome('???')).toBe('SEM-NOME');
  });

  it('fotos: TAG_ITEM_n, GERAL, PLACA, sem TAG e sem repetir nome', () => {
    const equipamentos = [
      { id: 'e1', tag: 'XA-TC-01', nome: 'TRANSPORTADORA 01' },
      { id: 'e2', tag: null, nome: 'SALA DE PAINÉIS' },
      { id: 'e3', tag: null, nome: 'SALA DE PAINÉIS' },
    ];
    const itens = [
      { id: 'i1', equipamentoId: 'e1', nome: 'MOTOR ' },
      { id: 'i2', equipamentoId: 'e1', nome: 'MOTOR' },
      { id: 'i3', equipamentoId: 'e2', nome: 'CCM' },
      { id: 'i4', equipamentoId: 'e3', nome: 'CCM' },
    ];
    const f = (id: string, alvoId: string, min: number, daPlaca?: boolean) => ({
      id,
      alvoId,
      criadaEm: `2026-10-26T13:${String(min).padStart(2, '0')}:00Z`,
      daPlaca,
    });
    const nomes = nomesDasFotos(
      [
        f('b', 'i1', 2),
        f('a', 'i1', 1),
        f('c', 'i2', 3),
        f('d', 'i1', 4, true),
        f('e', 'e1', 5),
        f('g', 'i3', 6),
        f('h', 'i4', 7),
        f('z', 'sumiu', 8),
      ],
      equipamentos,
      itens,
    );
    expect(Object.fromEntries(nomes)).toEqual({
      a: 'XA-TC-01_MOTOR_1.jpg',
      b: 'XA-TC-01_MOTOR_2.jpg',
      c: 'XA-TC-01_MOTOR_3.jpg',
      d: 'XA-TC-01_MOTOR_PLACA_1.jpg',
      e: 'XA-TC-01_GERAL_1.jpg',
      g: 'SALA-DE-PAINEIS_CCM_1.jpg',
      h: 'SALA-DE-PAINEIS_CCM_2.jpg',
      z: 'SEM-ITEM_FOTO_1.jpg',
    });
    expect(new Set(nomes.values()).size).toBe(nomes.size);
  });
});

describe('zip das fotos', () => {
  it('CRC-32 conhecido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('abre em outro programa com os nomes, datas e bytes iguais, sem compressão', async () => {
    const arquivos = [0, 1, 2].map((k) => {
      const bytes = new Uint8Array(10_000 + k * 777).map((_, i) => (i * 31 + k) & 0xff);
      return {
        nome: `XA-TC-01_MOTOR_${k + 1}.jpg`,
        blob: new Blob([bytes], { type: 'image/jpeg' }),
        data: new Date(2026, 9, 26, 14, 30 + k, 10),
      };
    });
    const progresso: number[] = [];
    const zip = await gerarZip(arquivos, (f) => progresso.push(f));
    expect(progresso).toEqual([0, 1, 2, 3]);
    expect(zip.type).toBe('application/zip');
    // Sem compressão: tamanho = dados + cabeçalhos (30 + 46 + 2 × nome por arquivo) + 22.
    const dados = arquivos.reduce((s, a) => s + a.blob.size, 0);
    const nomes = arquivos.reduce((s, a) => s + a.nome.length, 0);
    expect(zip.size).toBe(dados + 76 * 3 + 2 * nomes + 22);

    const lido = await JSZip.loadAsync(await zip.arrayBuffer(), { checkCRC32: true });
    expect(Object.keys(lido.files)).toEqual(arquivos.map((a) => a.nome));
    for (const a of arquivos) {
      const f = lido.file(a.nome)!;
      expect(await f.async('uint8array')).toEqual(new Uint8Array(await a.blob.arrayBuffer()));
      expect(f.date.getMinutes()).toBe(a.data.getMinutes());
    }
  });

  it('zip vazio também é válido', async () => {
    const lido = await JSZip.loadAsync(await (await gerarZip([])).arrayBuffer());
    expect(Object.keys(lido.files)).toEqual([]);
  });
});
