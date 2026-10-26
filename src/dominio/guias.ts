/**
 * Guias da ficha do equipamento (a barra de cima, como no protótipo de campo): cada item vai
 * para a guia do seu tipo, na ordem em que se mede uma transportadora. Só aparecem as guias de
 * medida que têm item; PCM, Fotos e Notas aparecem sempre.
 */
import { normalizar } from './texto.ts';
import type { ItemPcm, TipoItem } from './tipos.ts';

export type IdGuia =
  'pcm' | 'correia' | 'tambores' | 'roletes' | 'acionamento' | 'outros' | 'fotos' | 'notas';

const GUIA_DO_TIPO: Readonly<Record<TipoItem, IdGuia>> = {
  tapete: 'correia',
  tambor: 'tambores',
  mancal: 'tambores',
  rolete: 'roletes',
  motor: 'acionamento',
  redutor: 'acionamento',
  polia: 'acionamento',
  'correia-v': 'acionamento',
  acoplamento: 'acionamento',
  rotor: 'outros',
  tela: 'outros',
  'cabo-aco': 'outros',
  canecas: 'outros',
  hidraulico: 'outros',
  sensor: 'outros',
  painel: 'outros',
  iluminacao: 'outros',
  generico: 'outros',
};

const DE_MEDIDA = ['correia', 'tambores', 'roletes', 'acionamento', 'outros'] as const;

const ROTULOS: Readonly<Record<IdGuia, string>> = {
  pcm: 'PCM',
  correia: 'Correia',
  tambores: 'Tambores',
  roletes: 'Roletes',
  acionamento: 'Acionamento',
  outros: 'Outros',
  fotos: 'Fotos',
  notas: 'Notas',
};

export interface Guia<T> {
  id: IdGuia;
  rotulo: string;
  /** Itens na ordem da guia (PCM e Fotos: todos; Notas: nenhum). */
  itens: T[];
}

export const guiaDoItem = (item: Pick<ItemPcm, 'tipo'>): IdGuia => GUIA_DO_TIPO[item.tipo];

export function guiasDaFicha<T extends Pick<ItemPcm, 'tipo'>>(itens: readonly T[]): Guia<T>[] {
  const deMedida = DE_MEDIDA.map((id) => {
    const daGuia = itens.filter((i) => guiaDoItem(i) === id);
    if (id !== 'tambores') return { id, rotulo: ROTULOS[id], itens: daGuia };
    // Cada tambor (com o seu mancal) primeiro; depois as linhas MANCAL/ROLAMENTO/BUCHA do PCM.
    const tambores = daGuia.filter((i) => i.tipo === 'tambor');
    return {
      id,
      rotulo: tambores.length > 0 ? 'Tambores' : 'Mancais',
      itens: [...tambores, ...daGuia.filter((i) => i.tipo !== 'tambor')],
    };
  }).filter((g) => g.itens.length > 0);
  return [
    { id: 'pcm', rotulo: ROTULOS.pcm, itens: [...itens] },
    ...deMedida,
    { id: 'fotos', rotulo: ROTULOS.fotos, itens: [...itens] },
    { id: 'notas', rotulo: ROTULOS.notas, itens: [] },
  ];
}

/** Onde a ficha abre na primeira vez: a primeira guia de medida (ou o PCM, se não houver). */
export function guiaInicial(guias: readonly Guia<unknown>[]): IdGuia {
  return guias.find((g) => (DE_MEDIDA as readonly IdGuia[]).includes(g.id))?.id ?? 'pcm';
}

/** A guia pedida (endereço, memória) se ela existe nesta ficha; senão, a inicial. */
export function guiaValida(guias: readonly Guia<unknown>[], pedida: string | null | undefined) {
  return guias.find((g) => g.id === pedida)?.id ?? guiaInicial(guias);
}

/** A guia seguinte na barra (null na última). */
export function proximaGuia<T>(guias: readonly Guia<T>[], atual: IdGuia): Guia<T> | null {
  const k = guias.findIndex((g) => g.id === atual);
  return k < 0 ? null : (guias[k + 1] ?? null);
}

const CAMPO_DO_TAMBOR: ReadonlyArray<readonly [RegExp, string]> = [
  [/^MANCAL/, 'mancal'],
  [/^ROLAMENTO/, 'rolamento'],
  [/^BUCHA/, 'bucha'],
];

/** Campo do tambor que corresponde a uma linha MANCAL/ROLAMENTO/BUCHA do PCM; null nas outras. */
export function campoDoTambor(linha: Pick<ItemPcm, 'tipo' | 'nome'>): string | null {
  if (linha.tipo !== 'mancal') return null;
  const nome = normalizar(linha.nome);
  return CAMPO_DO_TAMBOR.find(([re]) => re.test(nome))?.[1] ?? null;
}

/**
 * O que o técnico já anotou nos tambores para uma linha MANCAL/ROLAMENTO/BUCHA do PCM
 * ("Tambor 1: SNA 515 · Tambor 2: SNA 515"), para ele conferir a linha da planilha sem
 * procurar. null quando a linha não é dessas ou nada foi anotado.
 */
export function anotadoNosTambores(
  linha: Pick<ItemPcm, 'tipo' | 'nome'>,
  tambores: readonly Pick<ItemPcm, 'id' | 'nome'>[],
  valores: (itemId: string) => Readonly<Record<string, string>> | undefined,
): string | null {
  const campo = campoDoTambor(linha);
  if (!campo) return null;
  const partes = tambores.flatMap((t) => {
    const v = valores(t.id)?.[campo]?.trim();
    return v ? [`${rotuloDoTambor(t.nome)}: ${v}`] : [];
  });
  return partes.length > 0 ? partes.join(' · ') : null;
}

/** "TAMBOR 1" → "Tambor 1" (o nome do PCM vem em maiúsculas). */
export const rotuloDoTambor = (nome: string) => nome.charAt(0) + nome.slice(1).toLowerCase();
