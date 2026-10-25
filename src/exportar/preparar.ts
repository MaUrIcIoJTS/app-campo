/**
 * Prepara os arquivos de exportação a partir do que está no aparelho. Tudo offline; SheetJS
 * só carrega (do cache) para a planilha.
 *
 * O arquivo leva o que o técnico vê na tela: a fila é descarregada antes e o que ainda estiver
 * só no diário (banco cheio) entra por cima do banco — é justamente quando o backup mais importa.
 */
import { version as VERSAO_APP } from '../../package.json';
import { pendentesMaisNovos } from '../db/edicao.ts';
import { VERSAO_BANCO } from '../db/esquema.ts';
import { lerTudo, type TudoDoBanco } from '../db/repositorio.ts';
import { emOrdem } from '../dominio/fotos.ts';
import { emOperacaoCritica, filaDeGravacao } from '../db/salvamento.ts';
import { gerarBackup } from './backup.ts';
import { MIME, nomeDaPlanilha, nomeDoBackup, nomeDoZip, nomesDasFotos } from './nomes.ts';
import { gerarZip } from './zip.ts';

export { VERSAO_APP };

/** Não deu para preparar: a mensagem já é o texto para o técnico. */
export class ErroAoPreparar extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroAoPreparar';
  }
}

export const MENSAGEM_FOTO_GRAVANDO =
  'Uma foto ainda está sendo salva (ou outra operação está em andamento). Espere aparecer “✓ Salvo no aparelho” e tente de novo.';

/** Retrato do aparelho para exportar: banco + o que o diário tem de mais novo. */
export async function retratoParaExportar(): Promise<TudoDoBanco> {
  if (emOperacaoCritica()) throw new ErroAoPreparar(MENSAGEM_FOTO_GRAVANDO);
  await filaDeGravacao.descarregar();
  const t = await lerTudo();
  const pendentes = pendentesMaisNovos(
    new Map(t.medicoes.map((m) => [m.itemId, m])),
    new Map(t.notas.map((n) => [n.equipamentoId, n])),
  );
  if (pendentes.medicoes.length === 0 && pendentes.notas.length === 0) return t;
  const medicoes = new Map(t.medicoes.map((m) => [m.itemId, m]));
  for (const m of pendentes.medicoes) medicoes.set(m.itemId, m);
  const notas = new Map(t.notas.map((n) => [n.equipamentoId, n]));
  for (const n of pendentes.notas) notas.set(n.equipamentoId, n);
  return { ...t, medicoes: [...medicoes.values()], notas: [...notas.values()] };
}

type Progresso = (feitas: number, total: number) => void;

export async function prepararBackup(
  aoProgredir?: Progresso,
): Promise<{ arquivo: File; criadoEm: Date; fotos: number }> {
  const t = await retratoParaExportar();
  const criadoEm = new Date();
  const blob = await gerarBackup(t, {
    criadoEm,
    esquemaDb: VERSAO_BANCO,
    app: VERSAO_APP,
    aoProgredir,
  });
  return {
    arquivo: new File([blob], nomeDoBackup(criadoEm), { type: MIME.json }),
    criadoEm,
    fotos: t.fotos.length,
  };
}

export async function prepararPlanilha(): Promise<File> {
  const t = await retratoParaExportar();
  const imp = t.importacoes.find((i) => i.id === t.importacaoAtual);
  if (!imp) throw new ErroAoPreparar('Importe o PCM antes de exportar a planilha.');
  let gerarPlanilha: typeof import('./planilha.ts').gerarPlanilha;
  try {
    ({ gerarPlanilha } = await import('./planilha.ts'));
  } catch (e) {
    console.error(e);
    throw new ErroAoPreparar(
      'Uma parte do app não carregou. Abra o app uma vez com internet e tente de novo.',
    );
  }
  const agora = new Date();
  const r = gerarPlanilha({
    arquivoOriginal: await imp.arquivo.arrayBuffer(),
    equipamentos: t.equipamentos,
    itens: t.itens,
    medicoes: new Map(t.medicoes.map((m) => [m.itemId, m])),
    notas: new Map(t.notas.map((n) => [n.equipamentoId, n])),
    fotos: t.fotos.map((f) => ({ alvoId: f.alvoId, criadaEm: f.criadaEm })),
    geradoEm: agora,
  });
  return new File([r.bytes as BlobPart], nomeDaPlanilha(agora), { type: MIME.xlsx });
}

export async function prepararZip(aoProgredir?: Progresso): Promise<File> {
  const t = await retratoParaExportar();
  if (t.fotos.length === 0) throw new ErroAoPreparar('Ainda não há fotos neste aparelho.');
  const nomes = nomesDasFotos(t.fotos, t.equipamentos, t.itens);
  const arquivos = emOrdem(t.fotos).map((f) => ({
    nome: nomes.get(f.id)!,
    blob: f.blob, // o blob do banco entra no zip por referência (não copia)
    data: new Date(f.criadaEm),
  }));
  const agora = new Date();
  const blob = await gerarZip(arquivos, aoProgredir);
  return new File([blob], nomeDoZip(agora), { type: MIME.zip });
}
