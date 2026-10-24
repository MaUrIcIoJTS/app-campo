/**
 * Modelo do PCM importado (somente leitura depois da importação).
 * As medições, fotos e observações do usuário ficam em stores separados no
 * IndexedDB e apontam para estes ids — reimportar o PCM nunca apaga medição.
 */

export type TipoItem =
  | 'tapete'
  | 'tambor'
  | 'rolete'
  | 'mancal'
  | 'redutor'
  | 'motor'
  | 'polia'
  | 'correia-v'
  | 'acoplamento'
  | 'tela'
  | 'cabo-aco'
  | 'canecas'
  | 'hidraulico'
  | 'sensor'
  | 'painel'
  | 'iluminacao'
  | 'generico';

/** De onde veio o item: linha do PCM, deduzido pelo app (ex.: tambores) ou criado em campo. */
export type OrigemItem = 'pcm' | 'deduzido' | 'manual';

export interface ItemPcm {
  /** `<id do equipamento>:<linha>` ou `<id do equipamento>:tambor-<n>` */
  id: string;
  origem: OrigemItem;
  /** Índice (0-based) da linha na aba original; null para itens que não estão no PCM. */
  linha: number | null;
  /** Coluna B — item a inspecionar. */
  nome: string;
  /** Coluna C — especificação (texto livre). */
  especificacao: string;
  /** Coluna D — quantidade, como está escrita ("4 UNIDADES", "27 METROS"). */
  quantidade: string;
  tipo: TipoItem;
}

export interface EquipamentoPcm {
  /** `<slug da aba>:<linha inicial>` — estável enquanto o PCM não mudar de layout. */
  id: string;
  aba: string;
  /** Linha (0-based) onde o bloco começa na aba. */
  linha: number;
  /** Coluna A completa, como está na planilha. */
  nomeOriginal: string;
  /** Nome sem a TAG. */
  nome: string;
  tag: string | null;
  itens: ItemPcm[];
}

export interface AbaPcm {
  nome: string;
  equipamentos: EquipamentoPcm[];
  /** Problemas de leitura que o usuário deve saber (cabeçalho não achado etc.). */
  avisos: string[];
}

export interface Pcm {
  abas: AbaPcm[];
}
