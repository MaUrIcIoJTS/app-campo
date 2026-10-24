import type { ItemPcm, TipoItem } from '../tipos.ts';
import { parseCodigoRolete, type CodigoRolete } from '../rolete.ts';
import * as x from './extratores.ts';

/** Desenho de referência "onde medir" (`src/ui/desenhos/`). */
export type IdDesenho =
  | 'vista-superior'
  | 'tapete-corte'
  | 'tambor'
  | 'rolete'
  | 'acionamento'
  | 'motor'
  | 'redutor'
  | 'acoplamento'
  | 'mancal'
  | 'polia'
  | 'correia-v'
  | 'rotor'
  | 'caneca'
  | 'tela'
  | 'cabo-aco';

export interface CampoTemplate {
  id: string;
  rotulo: string;
  tipo: 'numero' | 'texto' | 'opcoes';
  unidade?: string;
  opcoes?: readonly string[];
  /** Valor de referência do PCM para mostrar ao lado do campo (e calcular Δ). */
  pcm?: (item: ItemPcm) => string | number | null;
  /** Ajuda curta mostrada abaixo do campo. */
  dica?: string;
}

export interface TemplateItem {
  tipo: TipoItem;
  nome: string;
  desenhos: readonly IdDesenho[];
  campos: readonly CampoTemplate[];
  /** Mostra o botão "Foto da placa" em destaque. */
  fotoPlaca?: boolean;
}

// Toda ficha também tem, fora do template: ✓/✗ por campo, observação e fotos.

const num = (id: string, rotulo: string, unidade: string, extra: Partial<CampoTemplate> = {}) =>
  ({ id, rotulo, tipo: 'numero', unidade, ...extra }) satisfies CampoTemplate;
const txt = (id: string, rotulo: string, extra: Partial<CampoTemplate> = {}) =>
  ({ id, rotulo, tipo: 'texto', ...extra }) satisfies CampoTemplate;
const opc = (
  id: string,
  rotulo: string,
  opcoes: readonly string[],
  extra: Partial<CampoTemplate> = {},
) => ({ id, rotulo, tipo: 'opcoes', opcoes, ...extra }) satisfies CampoTemplate;

const doRolete = (k: keyof CodigoRolete) => (i: ItemPcm) =>
  parseCodigoRolete(i.especificacao)?.[k] ?? null;
const espec = (i: ItemPcm) => i.especificacao || null;
const qtd = num('quantidade', 'Quantidade', 'un', { pcm: (i) => x.quantidade(i.quantidade) });
const ESTADO = ['Bom', 'Folga', 'Ruído', 'Aquecido', 'Vazando', 'Danificado'] as const;

/** Campos de conferência simples (tela, sensores, painéis…): modelo + quantidade. */
const conferencia = (
  tipo: TipoItem,
  nome: string,
  extras: CampoTemplate[] = [],
  desenhos: IdDesenho[] = [],
): TemplateItem => ({
  tipo,
  nome,
  desenhos,
  campos: [txt('modelo', 'Modelo / medida principal', { pcm: espec }), ...extras, qtd],
});

export const TEMPLATES: Readonly<Record<TipoItem, TemplateItem>> = {
  tapete: {
    tipo: 'tapete',
    nome: 'Tapete / correia transportadora',
    desenhos: ['vista-superior', 'tapete-corte'],
    campos: [
      num('largura', 'Largura', 'mm', {
        pcm: (i) => x.larguraTapeteMm(i.especificacao),
        dica: 'PCM em polegadas, convertido para mm.',
      }),
      num('lonas', 'Lonas', 'un', { pcm: (i) => x.lonasTapete(i.especificacao) }),
      txt('coberturas', 'Coberturas sup. × inf.', {
        pcm: (i) => x.coberturasTapete(i.especificacao),
      }),
      num('espessura', 'Espessura total', 'mm', {
        pcm: (i) => x.espessuraTapeteMm(i.especificacao),
      }),
      num('comprimento', 'Comprimento', 'm', { pcm: (i) => x.quantidade(i.quantidade) }),
      num('centroLd', 'Centro a centro LD', 'mm', {
        dica: 'Entre centros dos tambores, lado direito.',
      }),
      num('centroLe', 'Centro a centro LE', 'mm', {
        dica: 'Mesmo ponto, lado esquerdo. Avisa se LD ≠ LE.',
      }),
    ],
  },
  tambor: {
    tipo: 'tambor',
    nome: 'Tambor / rolo',
    desenhos: ['tambor'],
    campos: [
      opc('funcao', 'Função', ['Tração', 'Retorno', 'Esticador', 'Desvio', 'Encosto']),
      num('diametro', 'Ø do tambor', 'mm'),
      num('comprimento', 'Comprimento (face)', 'mm'),
      num('eixoMancal', 'Ø eixo no mancal', 'mm', { pcm: (i) => x.diametroEixo(i.especificacao) }),
      // id antigo mantido (é a chave das medições salvas); o rótulo serve também ao eixo vazado
      num('pontaAcoplamento', 'Ø ponta (redutor ou acoplamento)', 'mm'),
      txt('chaveta', 'Chaveta da ponta', { dica: 'Largura × altura, ex.: 14 × 9' }),
      num('comprimentoEixo', 'Comprimento total do eixo', 'mm'),
    ],
  },
  rolete: {
    tipo: 'rolete',
    nome: 'Rolete',
    desenhos: ['rolete'],
    campos: [
      num('a', 'A — comprimento do tubo', 'mm', { pcm: doRolete('comprimentoTubo') }),
      num('b', 'B — comprimento do eixo', 'mm', { pcm: doRolete('comprimentoEixo') }),
      num('c', 'C — Ø do tubo', 'mm', { pcm: doRolete('diametroTubo') }),
      num('d', 'D — fresado', 'mm', {
        pcm: doRolete('fresado'),
        dica: 'Medida entre as faces planas da ponta.',
      }),
      num('e', 'E — Ø do eixo', 'mm', { pcm: doRolete('diametroEixo') }),
      qtd,
    ],
  },
  mancal: {
    tipo: 'mancal',
    nome: 'Mancal / rolamento / bucha',
    desenhos: ['mancal'],
    campos: [
      txt('codigo', 'Código gravado', { pcm: espec }),
      num('eixo', 'Ø do eixo', 'mm', { pcm: (i) => x.diametroEixo(i.especificacao) }),
      opc('estado', 'Estado', ESTADO),
      qtd,
    ],
  },
  redutor: {
    tipo: 'redutor',
    nome: 'Redutor / motorredutor',
    desenhos: ['redutor', 'acionamento'],
    fotoPlaca: true,
    campos: [
      txt('modelo', 'Fabricante / modelo', { pcm: espec }),
      txt('reducao', 'Redução', { pcm: (i) => x.reducao(i.especificacao), dica: 'Ex.: 1:30' }),
      txt('serie', 'Nº de série', { pcm: (i) => x.numeroSerie(i.especificacao) }),
      opc('entrada', 'Entrada', ['Polia e correia', 'Acoplamento direto', 'Motor flangeado']),
      num('eixoEntrada', 'Ø eixo de entrada', 'mm'),
      txt('chavetaEntrada', 'Chaveta de entrada'),
      opc('saida', 'Saída', ['Eixo maciço', 'Eixo vazado'], {
        pcm: (i) => x.saidaRedutor(i.especificacao),
      }),
      num('eixoSaida', 'Ø eixo de saída', 'mm'),
      txt('chavetaSaida', 'Chaveta de saída'),
    ],
  },
  motor: {
    tipo: 'motor',
    nome: 'Motor',
    desenhos: ['motor', 'acionamento'],
    fotoPlaca: true,
    campos: [
      num('potencia', 'Potência', 'cv', { pcm: (i) => x.potenciaCv(i.especificacao) }),
      num('rotacao', 'Rotação', 'rpm', { pcm: (i) => x.rotacaoRpm(i.especificacao) }),
      txt('tensao', 'Tensão', { dica: 'Ex.: 220/380/440 V' }),
      num('corrente', 'Corrente nominal', 'A'),
      txt('carcaca', 'Carcaça', { dica: 'Ex.: 112M' }),
      num('pontaEixo', 'Ø ponta de eixo', 'mm'),
      txt('chaveta', 'Chaveta da ponta', { dica: 'Largura × altura, ex.: 8 × 7' }),
    ],
  },
  polia: {
    tipo: 'polia',
    nome: 'Polia',
    desenhos: ['polia'],
    campos: [
      num('diametro', 'Ø externo', 'mm', { pcm: (i) => x.diametroPolia(i.especificacao) }),
      num('canais', 'Nº de canais', 'un', { pcm: (i) => x.canaisPolia(i.especificacao) }),
      txt('perfil', 'Perfil', {
        pcm: (i) => x.perfilPolia(i.especificacao),
        dica: 'A, B, C, SPA, SPB…',
      }),
      num('furo', 'Furo', 'mm', { pcm: (i) => x.furo(i.especificacao) }),
      txt('chaveta', 'Chaveta'),
    ],
  },
  'correia-v': {
    tipo: 'correia-v',
    nome: 'Correia em V',
    desenhos: ['correia-v', 'polia'],
    campos: [
      txt('codigo', 'Código da correia', {
        pcm: (i) => x.codigoCorreiaV(i.especificacao),
        dica: 'Gravado na correia, ex.: B50',
      }),
      qtd,
    ],
  },
  acoplamento: {
    tipo: 'acoplamento',
    nome: 'Acoplamento',
    desenhos: ['acoplamento'],
    campos: [
      txt('modelo', 'Tipo / modelo', { pcm: espec }),
      num('diametro', 'Ø externo', 'mm', { pcm: (i) => x.diametroExterno(i.especificacao) }),
      num('furo1', 'Furo lado motor', 'mm', { pcm: (i) => x.furo(i.especificacao) }),
      num('furo2', 'Furo lado movido', 'mm'),
      txt('chavetas', 'Chavetas'),
    ],
  },
  rotor: {
    tipo: 'rotor',
    nome: 'Rotor / roda',
    desenhos: ['rotor'],
    campos: [
      num('diametro', 'Ø externo', 'mm', {
        pcm: (i) => x.dimensoesRotor(i.especificacao)?.[0] ?? null,
      }),
      num('largura', 'Largura', 'mm', {
        pcm: (i) => x.dimensoesRotor(i.especificacao)?.[1] ?? null,
      }),
      num('eixo', 'Ø do eixo', 'mm', { pcm: (i) => x.diametroEixo(i.especificacao) }),
      num('pas', 'Nº de pás', 'un', { pcm: (i) => x.pasRotor(i.especificacao) }),
      opc('estado', 'Estado', ['Bom', 'Desgaste', 'Incrustado', 'Vibração', 'Danificado']),
      txt('referencia', 'Referência do PCM', { pcm: espec, dica: 'Texto do PCM, para conferir.' }),
    ],
  },
  tela: conferencia(
    'tela',
    'Tela de peneira',
    [
      num('malha', 'Malha', 'mm', {
        pcm: (i) => x.malhaTela(i.especificacao),
        dica: 'Vão livre entre fios.',
      }),
      num('fio', 'Fio', 'mm', { pcm: (i) => x.fioTela(i.especificacao) }),
    ],
    ['tela'],
  ),
  'cabo-aco': conferencia(
    'cabo-aco',
    'Cabo de aço',
    [
      num('diametro', 'Ø do cabo', 'mm', {
        pcm: (i) => x.diametroCaboMm(i.especificacao),
        dica: 'Por cima de 2 pernas opostas.',
      }),
    ],
    ['cabo-aco'],
  ),
  canecas: conferencia(
    'canecas',
    'Canecas',
    [
      num('a', 'A — altura', 'mm', { pcm: (i) => x.dimensoes3(i.especificacao)?.[0] ?? null }),
      num('l', 'L — largura', 'mm', { pcm: (i) => x.dimensoes3(i.especificacao)?.[1] ?? null }),
      num('p', 'P — profundidade', 'mm', {
        pcm: (i) => x.dimensoes3(i.especificacao)?.[2] ?? null,
      }),
    ],
    ['caneca'],
  ),
  hidraulico: conferencia('hidraulico', 'Hidráulico / cilindro'),
  sensor: conferencia('sensor', 'Sensor / chave / instrumento'),
  painel: conferencia('painel', 'Painel / comando'),
  iluminacao: conferencia('iluminacao', 'Iluminação'),
  generico: {
    tipo: 'generico',
    nome: 'Genérico',
    desenhos: [],
    campos: [txt('anotado', 'Medido / anotado', { pcm: espec })],
  },
};

export function templateDe(tipo: TipoItem): TemplateItem {
  return TEMPLATES[tipo];
}
