/**
 * Resumo do PCM para calibrar parser e templates. Só leitura, só local.
 *   npm run pcm:resumo                 → lê dados/pcm.xls
 *   npm run pcm:resumo -- outro.xlsx   → lê outro arquivo
 *   npm run pcm:resumo -- --genericos  → lista todos os itens que caíram no "genérico"
 */
import { readFileSync } from 'node:fs';
import { lerPcm } from '../src/dominio/pcm/parser.ts';
import { TEMPLATES } from '../src/dominio/templates/registro.ts';
import { normalizar } from '../src/dominio/texto.ts';
import type { TipoItem } from '../src/dominio/tipos.ts';

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith('--')) ?? 'dados/pcm.xls';
const listarGenericos = args.includes('--genericos');

const pcm = lerPcm(readFileSync(arquivo));
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const padE = (s: string | number, n: number) => String(s).padStart(n);

console.log(`\nArquivo: ${arquivo}\n`);
console.log(
  `${pad('Aba', 22)}${padE('Equip.', 7)}${padE('s/ TAG', 7)}${padE('Itens PCM', 10)}${padE('Tambores*', 10)}`,
);
let tot = { eq: 0, semTag: 0, itens: 0, tambores: 0 };
for (const aba of pcm.abas) {
  const itens = aba.equipamentos.flatMap((e) => e.itens);
  const l = {
    eq: aba.equipamentos.length,
    semTag: aba.equipamentos.filter((e) => !e.tag).length,
    itens: itens.filter((i) => i.origem === 'pcm').length,
    tambores: itens.filter((i) => i.origem === 'deduzido').length,
  };
  tot = {
    eq: tot.eq + l.eq,
    semTag: tot.semTag + l.semTag,
    itens: tot.itens + l.itens,
    tambores: tot.tambores + l.tambores,
  };
  console.log(
    `${pad(aba.nome, 22)}${padE(l.eq, 7)}${padE(l.semTag, 7)}${padE(l.itens, 10)}${padE(l.tambores, 10)}`,
  );
  for (const a of aba.avisos) console.log(`   ⚠ ${a}`);
}
console.log(
  `${pad('TOTAL', 22)}${padE(tot.eq, 7)}${padE(tot.semTag, 7)}${padE(tot.itens, 10)}${padE(tot.tambores, 10)}`,
);
console.log('* tambores deduzidos dos mancais (não estão no PCM)\n');

// Tipos detectados + cobertura dos extratores (quantos campos com referência PCM foram lidos).
const todos = pcm.abas
  .flatMap((a) => a.equipamentos.flatMap((e) => e.itens))
  .filter((i) => i.origem === 'pcm');
const porTipo = new Map<TipoItem, typeof todos>();
for (const i of todos) porTipo.set(i.tipo, [...(porTipo.get(i.tipo) ?? []), i]);

console.log(`${pad('Tipo detectado', 34)}${padE('Itens', 6)}${padE('%', 6)}   Ref. PCM extraída`);
for (const [tipo, itens] of [...porTipo].sort((a, b) => b[1].length - a[1].length)) {
  const campos = TEMPLATES[tipo].campos.filter((c) => c.pcm);
  const lidos = itens.reduce((s, i) => s + campos.filter((c) => c.pcm?.(i) != null).length, 0);
  const possiveis = itens.length * campos.length;
  const cobertura = possiveis
    ? `${Math.round((100 * lidos) / possiveis)}% (${lidos}/${possiveis})`
    : '—';
  console.log(
    `${pad(`${TEMPLATES[tipo].nome} [${tipo}]`, 34)}${padE(itens.length, 6)}${padE(Math.round((100 * itens.length) / todos.length), 5)}%   ${cobertura}`,
  );
}

const genericos = new Map<string, number>();
for (const i of porTipo.get('generico') ?? []) {
  const k = normalizar(i.nome);
  genericos.set(k, (genericos.get(k) ?? 0) + 1);
}
const lista = [...genericos].sort((a, b) => b[1] - a[1]);
console.log(
  `\nCaíram no genérico: ${porTipo.get('generico')?.length ?? 0} itens, ${lista.length} nomes distintos.`,
);
console.log(
  (listarGenericos ? lista : lista.slice(0, 25))
    .map(([k, v]) => `  ${padE(v, 3)}× ${k}`)
    .join('\n'),
);
if (!listarGenericos && lista.length > 25)
  console.log(`  … (+${lista.length - 25}; use --genericos para ver todos)`);
