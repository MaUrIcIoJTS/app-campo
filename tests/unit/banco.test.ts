import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirBanco, banco, fecharBanco } from '../../src/db/banco.ts';
import { MIGRACOES, VERSAO_BANCO, type Importacao, type Medicao } from '../../src/db/esquema.ts';
import {
  carregarDados,
  gravarImportacao,
  previaImportacao,
  salvarFoto,
  salvarMedicao,
  salvarNota,
} from '../../src/db/repositorio.ts';
import { lerPcm, parseAba, type Linha } from '../../src/dominio/pcm/parser.ts';
import type { Pcm } from '../../src/dominio/tipos.ts';

const FIXTURE = 'tests/fixtures/pcm-ficticio.xls';

beforeEach(async () => {
  await fecharBanco();
  globalThis.indexedDB = new IDBFactory();
});

function linhasDaFixture(): Map<string, Linha[]> {
  const wb = XLSX.read(readFileSync(FIXTURE));
  return new Map(
    wb.SheetNames.map((n) => [
      n,
      XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: true,
      }),
    ]),
  );
}

function pcmDe(abas: Map<string, Linha[]>): Pcm {
  return { abas: [...abas].map(([nome, linhas]) => parseAba(nome, linhas)) };
}

async function importar(pcm: Pcm, id: string) {
  const { plano, existentes } = await previaImportacao(pcm, id);
  const importacao: Importacao = {
    id,
    nomeArquivo: 'pcm-ficticio.xls',
    importadaEm: '2026-10-24T10:00:00-03:00',
    tamanho: 123,
    abas: pcm.abas.map((a) => a.nome),
    arquivo: new Blob([readFileSync(FIXTURE)]),
  };
  await gravarImportacao(importacao, plano);
  return { plano, existentes };
}

const medicao = (itemId: string, valor: string): Medicao => ({
  itemId,
  valores: { largura: valor },
  conferencia: { largura: 'diverge' },
  observacao: 'emenda solta',
  atualizadaEm: '2026-10-26T09:00:00-03:00',
});

async function itemPorNome(tag: string, nome: string) {
  const dados = await carregarDados();
  const eq = dados.equipamentos.find((e) => e.tag === tag && !e.orfao);
  const item = eq && dados.itensPorEquipamento.get(eq.id)?.find((i) => i.nome === nome);
  if (!eq || !item) throw new Error(`${tag}/${nome} não encontrado`);
  return { dados, eq, item };
}

describe('esquema e migrações', () => {
  it('versão 1 cria todas as stores', async () => {
    const db = await abrirBanco('t-esquema');
    expect(db.version).toBe(VERSAO_BANCO);
    expect([...db.objectStoreNames].sort()).toEqual(
      ['equipamentos', 'fotos', 'importacoes', 'itens', 'medicoes', 'meta', 'notas'].sort(),
    );
    db.close();
  });

  it('dados sobrevivem a fechar e reabrir', async () => {
    let db = await abrirBanco('t-reabrir');
    await db.put('medicoes', medicao('x:1', '660'));
    db.close();
    db = await abrirBanco('t-reabrir');
    expect(await db.get('medicoes', 'x:1')).toMatchObject({ valores: { largura: '660' } });
    db.close();
  });

  it('uma migração futura (v1 → v2) preserva os dados da v1', async () => {
    const v1 = await abrirBanco('t-migra');
    await v1.put('medicoes', medicao('x:1', '660'));
    await v1.put('fotos', {
      id: 'f1',
      alvoId: 'x:1',
      blob: new Blob(['jpeg']),
      criadaEm: '',
      largura: 1,
      altura: 1,
    });
    v1.close();

    const v2 = await abrirBanco('t-migra', [
      ...MIGRACOES,
      (_db, tx) => tx.objectStore('medicoes').createIndex('porData', 'atualizadaEm'),
    ]);
    expect(v2.version).toBe(VERSAO_BANCO + 1);
    expect(await v2.get('medicoes', 'x:1')).toMatchObject({ observacao: 'emenda solta' });
    const foto = await v2.get('fotos', 'f1');
    expect(await foto?.blob.text()).toBe('jpeg');
    expect([...v2.transaction('medicoes').store.indexNames]).toContain('porData');
    v2.close();
  });
});

describe('importação', () => {
  it('grava e carrega o PCM fictício, guardando o arquivo original', async () => {
    const { existentes } = await importar(lerPcm(readFileSync(FIXTURE)), 'imp-1');
    expect(existentes).toEqual({ medicoes: 0, fotos: 0, notas: 0 });

    const dados = await carregarDados();
    expect(dados.importacao).toMatchObject({ id: 'imp-1', nomeArquivo: 'pcm-ficticio.xls' });
    expect(dados.importacao).not.toHaveProperty('arquivo');
    expect(dados.equipamentos).toHaveLength(9);
    expect(dados.equipamentos.map((e) => e.tag).slice(2, 5)).toEqual([
      'XA-TC-01',
      'XA-TC-02',
      'XA-EC-01',
    ]);
    const tc01 = dados.equipamentos.find((e) => e.tag === 'XA-TC-01')!;
    expect(dados.itensPorEquipamento.get(tc01.id)?.map((i) => i.nome)).toContain('TAMBOR 2');

    const arquivo = await (await banco()).get('importacoes', 'imp-1');
    expect(arquivo?.arquivo.size).toBe(readFileSync(FIXTURE).length);
  });

  it('reimportar o mesmo arquivo não mexe nas medições', async () => {
    const pcm = lerPcm(readFileSync(FIXTURE));
    await importar(pcm, 'imp-1');
    const { item } = await itemPorNome('XA-TC-01', 'TAPETE');
    await salvarMedicao(medicao(item.id, '658'));

    const { plano, existentes } = await importar(pcm, 'imp-2');
    expect(existentes.medicoes).toBe(1);
    expect(plano.resumo).toMatchObject({ remapeados: 0, orfaos: 0 });
    const depois = await carregarDados();
    expect(depois.medicoes.get(item.id)?.valores).toEqual({ largura: '658' });
  });

  it('linhas inseridas no PCM: medição, nota e foto acompanham o item certo', async () => {
    await importar(lerPcm(readFileSync(FIXTURE)), 'imp-1');
    const antes = await itemPorNome('XA-TC-01', 'TAPETE');
    const motor = await itemPorNome('XA-TC-01', 'MOTOR');
    await salvarMedicao(medicao(antes.item.id, '658'));
    await salvarMedicao(medicao(motor.item.id, '5'));
    await salvarNota({
      equipamentoId: antes.eq.id,
      observacao: 'proteção solta',
      atualizadaEm: '',
    });
    await salvarFoto({
      id: 'f1',
      alvoId: antes.item.id,
      blob: new Blob(['jpeg']),
      criadaEm: '',
      largura: 1,
      altura: 1,
    });

    // PCM novo: 3 linhas inseridas no começo da aba (todos os ids da aba mudam).
    const abas = linhasDaFixture();
    const area1 = abas.get('AREA 1')!;
    area1.splice(6, 0, ['EQUIPAMENTO NOVO XA-ZZ-99', 'MOTOR', '1CV', '1 UNIDADE'], [], []);
    const { plano } = await importar(pcmDe(abas), 'imp-2');
    expect(plano.resumo.orfaos).toBe(0);
    expect(plano.resumo.remapeados).toBeGreaterThanOrEqual(3);

    const depois = await itemPorNome('XA-TC-01', 'TAPETE');
    const motorDepois = await itemPorNome('XA-TC-01', 'MOTOR');
    expect(depois.item.id).not.toBe(antes.item.id);
    expect(depois.dados.medicoes.get(depois.item.id)?.valores).toEqual({ largura: '658' });
    expect(depois.dados.medicoes.get(motorDepois.item.id)?.valores).toEqual({ largura: '5' });
    expect(depois.dados.notas.get(depois.eq.id)?.observacao).toBe('proteção solta');
    expect(depois.dados.fotosPorAlvo.get(depois.item.id)).toBe(1);
    expect(depois.dados.medicoes.size).toBe(2);
  });

  it('item que sumiu do PCM novo vira órfão com a medição — nada é apagado', async () => {
    await importar(lerPcm(readFileSync(FIXTURE)), 'imp-1');
    const { item } = await itemPorNome('XA-TC-01', 'CHAVE DE SEGURANÇA');
    await salvarMedicao(medicao(item.id, 'modelo X'));

    const abas = linhasDaFixture();
    const area1 = abas.get('AREA 1')!;
    const k = area1.findIndex((l) => l[1] === 'CHAVE DE SEGURANÇA');
    area1.splice(k, 1);
    const { plano } = await importar(pcmDe(abas), 'imp-2');
    expect(plano.resumo.orfaos).toBe(1);

    const dados = await carregarDados();
    const tc01 = dados.equipamentos.find((e) => e.tag === 'XA-TC-01')!;
    const orfao = dados.itensPorEquipamento.get(tc01.id)?.find((i) => i.orfao);
    expect(orfao).toMatchObject({ nome: 'CHAVE DE SEGURANÇA', orfao: true });
    expect(dados.medicoes.get(orfao!.id)?.valores).toEqual({ largura: 'modelo X' });
    expect(dados.medicoes.size).toBe(1);

    // Reimportar de novo não duplica nem perde o órfão.
    await importar(pcmDe(abas), 'imp-3');
    const de3 = await carregarDados();
    expect([...de3.itensPorEquipamento.values()].flat().filter((i) => i.orfao)).toHaveLength(1);
    expect(de3.medicoes.size).toBe(1);
  });
});
