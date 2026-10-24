/** Desenho de referência de cada `IdDesenho`: título, legenda curta e o SVG. */
import type { FunctionComponent } from 'preact';
import type { IdDesenho } from '../../dominio/templates/registro.ts';
import { Acionamento } from './acionamento.tsx';
import { Acoplamento } from './acoplamento.tsx';
import { CaboAco } from './cabo-aco.tsx';
import { Caneca } from './caneca.tsx';
import { CorreiaV } from './correia-v.tsx';
import { Mancal } from './mancal.tsx';
import { Motor } from './motor.tsx';
import { Polia } from './polia.tsx';
import { Redutor } from './redutor.tsx';
import { Rolete } from './rolete.tsx';
import { Rotor } from './rotor.tsx';
import { Tambor } from './tambor.tsx';
import { TapeteCorte } from './tapete-corte.tsx';
import { Tela } from './tela.tsx';
import { VistaSuperior } from './vista-superior.tsx';

export interface Desenho {
  /** Nome curto no botão: "Desenho: <nome>" (cabe numa linha em 360 px). */
  nome: string;
  /** Uma ideia por linha (`\n`). */
  legenda: string;
  Svg: FunctionComponent;
}

export const DESENHOS: Readonly<Record<IdDesenho, Desenho>> = {
  'vista-superior': {
    nome: 'vista de cima',
    Svg: VistaSuperior,
    legenda:
      'LD e LE: lados direito e esquerdo olhando no sentido do fluxo.\n' +
      'Meça de centro a centro dos eixos dos dois tambores, nos dois lados.\n' +
      'Comprimento (m) é a volta inteira da lona, não o centro a centro: ' +
      '≈ 2 × centro a centro + 1,57 × (Ø tração + Ø retorno).',
  },
  'tapete-corte': {
    nome: 'corte',
    Svg: TapeteCorte,
    legenda:
      'Lonas = camadas de tecido: conte na borda ou na emenda (EP 1000/4 = 4 lonas).\n' +
      'Coberturas: anote em mm (ex.: 4,8 × 1,6). No PCM vêm em polegadas:\n' +
      // espaço não separável: cada par polegada = mm não quebra no meio
      ['1/16" = 1,6', '1/8" = 3,2', '3/16" = 4,8', '1/4" = 6,4 mm']
        .map((par) => par.replaceAll(' ', '\u00a0'))
        .join(' · '),
  },
  tambor: {
    nome: 'tambor',
    Svg: Tambor,
    legenda:
      'Ø por cima da borracha (se emborrachado, anote na observação).\n' +
      'Ponta e chaveta (largura × altura): só no tambor de tração.',
  },
  rolete: {
    nome: 'rolete',
    Svg: Rolete,
    legenda:
      'Código A×B×C×D×E.\nD é o fresado: a distância entre as faces planas da ponta do eixo.',
  },
  acionamento: {
    nome: 'acionamento',
    Svg: Acionamento,
    legenda:
      '1 Ponta do eixo do motor.\n' +
      '2 Eixo de entrada do redutor.\n' +
      '3 Saída: vazada (o eixo do tambor entra no redutor) ou maciça (com acoplamento).',
  },
  motor: {
    nome: 'motor',
    Svg: Motor,
    legenda:
      'Potência, rotação, tensão, corrente e carcaça vêm da placa.\n' +
      'Placa só em kW? Anote o kW na observação.\n' +
      'Chaveta: largura × altura.',
  },
  redutor: {
    nome: 'redutor',
    Svg: Redutor,
    legenda:
      'Redução (1:30, 30:1 ou i = 30) e nº de série estão na placa.\n' +
      'Saída maciça: Ø da ponta. Vazada: meça o eixo do tambor rente ao redutor.\n' +
      'Chavetas: largura × altura.',
  },
  acoplamento: {
    nome: 'acoplamento',
    Svg: Acoplamento,
    legenda: 'Cada furo é o Ø do eixo daquele lado.\nChavetas: largura × altura de cada lado.',
  },
  mancal: {
    nome: 'mancal',
    Svg: Mancal,
    legenda:
      'Sem abrir: confira o código da tampa (ex.: SNA 515).\n' +
      'Meça o eixo rente ao mancal, fora da vedação.\n' +
      'Dentro: rolamento autocompensador (ex.: 22215 K) preso no eixo pela bucha H/HE.',
  },
  polia: {
    nome: 'polia',
    Svg: Polia,
    legenda:
      'Ø externo por cima dos canais.\n' +
      'O perfil é a letra da correia (B 50 → perfil B). Furo = Ø do eixo.',
  },
  'correia-v': {
    nome: 'correia em V',
    Svg: CorreiaV,
    legenda:
      'B 50 = perfil B, 50 polegadas. SPA, SPB…: o número é o comprimento em mm.\n' +
      'Código apagado? Largura em cima: A 13 · B 17 · C 22 · D 32 mm.',
  },
  rotor: {
    nome: 'rotor',
    Svg: Rotor,
    legenda: 'Ø externo na ponta das pás; largura vista de lado.\nConte as pás.',
  },
  caneca: {
    nome: 'caneca',
    Svg: Caneca,
    legenda: 'Como no PCM: A × L × P (altura × largura × profundidade).',
  },
  tela: {
    nome: 'tela',
    Svg: Tela,
    legenda: 'Malha = vão livre entre dois fios (não de centro a centro).\nFio = Ø do arame.',
  },
  'cabo-aco': {
    nome: 'cabo de aço',
    Svg: CaboAco,
    legenda: 'Paquímetro por cima de duas pernas opostas, nunca nos vales entre as pernas.',
  },
};
