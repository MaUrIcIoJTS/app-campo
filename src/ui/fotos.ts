/**
 * Fotos: comprimir → gravar direto no IndexedDB → só então aparecer na tela.
 *
 * - Uma foto por vez (fila única): duas fotos de 50 MP decodificadas juntas, com a câmera
 *   ainda na memória, derrubam a aba num celular fraco.
 * - Cada foto esperada fica anotada em `fotosPendentes` até o banco confirmar: se o app
 *   fechar antes (Android com a câmera aberta, técnico fechando), o cartão avisa ao reabrir.
 * - O estado (andamento, falhas) fica neste módulo, e não no componente: sair da ficha no
 *   meio não perde o "Salvando…", e o topo mostra "⚠ Foto não salva" em qualquer tela.
 */
import { useEffect, useState } from 'preact/hooks';
import { estimarEspaco } from '../armazenamento.ts';
import type { Foto } from '../db/esquema.ts';
import { apagarFoto, salvarFoto } from '../db/repositorio.ts';
import { semEspaco, semRecarregarDurante } from '../db/salvamento.ts';
import { idNovaFoto, type SituacaoEspaco } from '../dominio/fotos.ts';
import { comprimirFoto, FotoIlegivel } from './comprimir.ts';
import {
  anotarPendencia,
  fotosPerdidasAoAbrir,
  riscarPendencias,
  type FotosPerdidas,
} from './fotosPendentes.ts';

/**
 * Seção de fotos de um alvo: as da placa (motor/redutor) têm bloco próprio no cartão, com
 * seu "Salvando…" e seus avisos.
 */
export const secaoDe = (alvoId: string, daPlaca: boolean) => (daPlaca ? `${alvoId}#placa` : alvoId);

/** Para onde vão as fotos de um botão. */
export interface Destino {
  alvoId: string;
  equipamentoId: string;
  daPlaca: boolean;
}

export interface Andamento {
  feitas: number;
  total: number;
}

/** Foto recebida que não gravou: o arquivo original fica para "Tentar de novo". */
interface ParaRefazer {
  arquivo: File;
  pendencia: string;
}

export interface Falha {
  destino: Destino;
  refazer: ParaRefazer[];
  semEspaco: boolean;
  ilegiveis: number;
  /** Fotos perdidas porque o app fechou antes de gravar (achadas ao reabrir). */
  perdidas: number;
}

export type MudancaFoto = { tipo: 'gravada'; foto: Foto } | { tipo: 'apagada'; foto: Foto };

type ContarFoto = (alvoId: string, delta: 1 | -1) => void;

/** Por seção (`secaoDe`): fotos sendo gravadas e falhas ainda não resolvidas. */
const andamento = new Map<string, Andamento>();
const falhas = new Map<string, Falha>();
let espaco: SituacaoEspaco | null = null;

const ouvintes = new Set<() => void>();
const ouvintesDeFotos = new Set<(m: MudancaFoto) => void>();
const avisar = () => {
  for (const fn of ouvintes) fn();
};

function falhaDe(secao: string, destino: Destino): Falha {
  let f = falhas.get(secao);
  if (!f) {
    f = { destino, refazer: [], semEspaco: false, ilegiveis: 0, perdidas: 0 };
    falhas.set(secao, f);
  }
  return f;
}

/** Ao abrir a página: fotos que o app não chegou a gravar viram aviso no cartão. */
export function carregarFotosPerdidas(perdidas: ReadonlyMap<string, FotosPerdidas>): void {
  for (const [secao, p] of perdidas) {
    const [alvoId = secao, placa] = secao.split('#');
    falhaDe(secao, { alvoId, equipamentoId: p.equipamentoId, daPlaca: !!placa }).perdidas += p.n;
  }
  avisar();
}
carregarFotosPerdidas(fotosPerdidasAoAbrir());

/** Redesenha quem usa este estado sempre que ele muda. */
function useMudancas(): void {
  const [, setVersao] = useState(0);
  useEffect(() => {
    const fn = () => setVersao((v) => v + 1);
    ouvintes.add(fn);
    return () => void ouvintes.delete(fn);
  }, []);
}

export const lerEstadoFotos = () => ({ andamento, falhas, espaco });

export function useEstadoFotos() {
  useMudancas();
  return lerEstadoFotos();
}

/** Para o topo: fotos na fila e a primeira seção com foto não salva. */
export function useResumoFotos(): { gravando: number; falha: [string, Falha] | null } {
  useMudancas();
  let gravando = 0;
  for (const a of andamento.values()) gravando += a.total - a.feitas;
  const primeira = falhas.entries().next();
  return { gravando, falha: primeira.done ? null : primeira.value };
}

/** Foto gravada ou apagada no banco (a ficha aberta põe/tira da tela). */
export function ouvirFotos(fn: (m: MudancaFoto) => void): () => void {
  ouvintesDeFotos.add(fn);
  return () => void ouvintesDeFotos.delete(fn);
}

export async function atualizarEspaco(): Promise<void> {
  espaco = await estimarEspaco();
  avisar();
}

const fotos = (n: number) => (n === 1 ? 'A foto não foi salva' : `${n} fotos não foram salvas`);

/** Texto do aviso no cartão (curto, uma ideia por frase). */
export function textoDaFalha(f: Falha): string {
  const partes: string[] = [];
  if (f.perdidas > 0)
    partes.push(
      `${fotos(f.perdidas)}: o app fechou antes de gravar (o Android costuma fechar o app com a câmera aberta). Tire de novo. Se repetir, tire com a câmera do celular e use “Galeria”.`,
    );
  const n = f.refazer.length;
  if (n > 0)
    partes.push(
      f.semEspaco
        ? `Celular sem espaço: ${fotos(n).toLowerCase()}. Apague fotos e vídeos do celular (fora do app) e toque em “Tentar de novo”.`
        : `${fotos(n)}. Toque em “Tentar de novo”.`,
    );
  if (f.ilegiveis > 0)
    partes.push(
      `${f.ilegiveis === 1 ? 'Não consegui abrir uma imagem' : `Não consegui abrir ${f.ilegiveis} imagens`}. Tire a foto pela câmera (“Tirar foto”).`,
    );
  return partes.join(' ');
}

/** Tocou num botão de foto: anota que uma foto vai chegar. Devolve o id da anotação. */
export function cameraAbrindo(secao: string, equipamentoId: string): string {
  return anotarPendencia({ secao, equipamentoId, tipo: 'camera' });
}

/** Voltou da câmera sem foto. */
export function cameraCancelada(abertura: string | undefined): void {
  if (abertura) riscarPendencias([abertura]);
}

/** Voltou da câmera/galeria com fotos: anota cada uma (até gravar) e põe na fila. */
export function receberFotos(
  destino: Destino,
  arquivos: readonly File[],
  abertura: string | undefined,
  contarFoto: ContarFoto,
): Promise<void> {
  const secao = secaoDe(destino.alvoId, destino.daPlaca);
  const itens = arquivos.map((arquivo) => ({
    arquivo,
    pendencia: anotarPendencia({ secao, equipamentoId: destino.equipamentoId, tipo: 'foto' }),
  }));
  cameraCancelada(abertura); // as fotos já estão anotadas uma a uma
  return gravarFotos(destino, itens, contarFoto);
}

let filaUnica: Promise<unknown> = Promise.resolve();
function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const vez = filaUnica.then(fn, fn);
  filaUnica = vez.catch(() => {});
  return vez;
}

/**
 * Comprime e grava, uma foto por vez (no app inteiro). Cada foto só entra na tela (e na
 * contagem) depois que o banco confirmar. Falha → aviso no cartão e no topo, com o arquivo
 * guardado para "Tentar de novo"; sem espaço, as próximas da leva nem são tentadas.
 */
async function gravarFotos(
  destino: Destino,
  itens: readonly ParaRefazer[],
  contarFoto: ContarFoto,
): Promise<void> {
  if (itens.length === 0) return;
  const secao = secaoDe(destino.alvoId, destino.daPlaca);
  // Uma leva nova para a mesma seção (tocou de novo antes de acabar) soma na mesma contagem.
  let a = andamento.get(secao);
  if (!a) andamento.set(secao, (a = { feitas: 0, total: 0 }));
  a.total += itens.length;
  avisar();
  const leva = { semEspaco: false };

  const umaFoto = async ({ arquivo, pendencia }: ParaRefazer) => {
    try {
      if (leva.semEspaco) {
        const f = falhaDe(secao, destino);
        f.refazer.push({ arquivo, pendencia });
        f.semEspaco = true;
        return;
      }
      const c = await comprimirFoto(arquivo);
      const foto: Foto = {
        id: idNovaFoto(),
        alvoId: destino.alvoId,
        blob: c.blob,
        miniatura: c.miniatura,
        criadaEm: new Date().toISOString(),
        largura: c.largura,
        altura: c.altura,
        ...(destino.daPlaca && { daPlaca: true }),
      };
      await salvarFoto(foto);
      riscarPendencias([pendencia]);
      contarFoto(destino.alvoId, 1);
      for (const fn of ouvintesDeFotos) fn({ tipo: 'gravada', foto });
    } catch (e) {
      console.error('Foto não gravada', secao, e);
      const f = falhaDe(secao, destino);
      if (e instanceof FotoIlegivel) {
        f.ilegiveis++;
        riscarPendencias([pendencia]); // tentar de novo não adianta: o aviso explica
      } else {
        f.refazer.push({ arquivo, pendencia });
        if (semEspaco(e)) f.semEspaco = leva.semEspaco = true;
      }
    } finally {
      a.feitas++;
      avisar();
    }
  };

  // Cada foto conta como operação crítica desde já (esperando na fila também): o
  // "Atualizar" e a importação esperam a leva inteira.
  await Promise.allSettled(
    itens.map((item) => semRecarregarDurante(() => naFila(() => umaFoto(item)))),
  );
  if (a.feitas >= a.total) andamento.delete(secao);
  avisar();
  void atualizarEspaco();
}

/** "Tentar de novo": grava outra vez as fotos que falharam (sem tirar de novo). */
export function tentarDeNovo(secao: string, contarFoto: ContarFoto): Promise<void> {
  const f = falhas.get(secao);
  if (!f) return Promise.resolve();
  falhas.delete(secao);
  avisar();
  return gravarFotos(f.destino, f.refazer, contarFoto);
}

/** "Entendi"/"Descartar": tira o aviso; as fotos que não gravaram são descartadas. */
export function dispensarAviso(secao: string): void {
  const f = falhas.get(secao);
  if (!f) return;
  riscarPendencias(f.refazer.map((r) => r.pendencia));
  falhas.delete(secao);
  avisar();
}

/** Apaga do banco; só some da tela depois que o banco confirmar. */
export async function apagar(foto: Foto, contarFoto: ContarFoto) {
  await apagarFoto(foto.id);
  contarFoto(foto.alvoId, -1);
  for (const fn of ouvintesDeFotos) fn({ tipo: 'apagada', foto });
  void atualizarEspaco();
}
