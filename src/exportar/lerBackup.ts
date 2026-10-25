/**
 * Leitura do backup (.json) para restaurar, SEM carregar o arquivo inteiro na memória.
 *
 * Um backup com 300–400 fotos tem ~270 MB. `file.text()` criaria uma string desse tamanho —
 * acima do limite do Chrome 32 bits (comum em Android barato) — e o `JSON.parse` dobraria a
 * conta. Aqui o arquivo é lido em fatias de 1 MB; `separarJson` corta o objeto raiz em campos
 * e as listas em elementos, e cada elemento (≤ ~1,5 MB) passa por um `JSON.parse` sozinho.
 * Cada foto vira Blob na hora e a string some.
 */
import { ehMedicao, ehNota } from '../db/edicao.ts';
import { VERSAO_BANCO, type Foto, type Importacao } from '../db/esquema.ts';
import type { TudoDoBanco } from '../db/repositorio.ts';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import { base64ParaBytes } from './base64.ts';
import { FORMATO_BACKUP, VERSAO_BACKUP, resumir, type ResumoBackup } from './backup.ts';

export const MENSAGEM = {
  naoEBackup:
    'Este arquivo não é um backup do app. Escolha o arquivo “levantamento-backup-….json”.',
  incompleto:
    'O backup está incompleto: o arquivo foi cortado no envio ou no download. Baixe de novo e tente outra vez.',
  versaoNova:
    'Este backup foi feito numa versão mais nova do app. Atualize o app (com internet) e tente de novo.',
  estragado: (onde: string) => `O backup tem um registro estragado (${onde}).`,
};

/** Backup recusado: a mensagem já é o texto para o técnico. Nada foi alterado. */
export class BackupInvalido extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'BackupInvalido';
  }
}

class JsonQuebrado extends Error {}
class JsonIncompleto extends Error {}

export interface ManipuladoresJson {
  /** Campo do objeto raiz que não é lista. */
  valor(chave: string, valor: unknown): void;
  /** Começou a lista do campo `chave`. */
  inicioLista?(chave: string): void;
  /** Um elemento da lista do campo `chave`. */
  elemento(chave: string, valor: unknown, indice: number): void;
}

// Estados do separador.
const INICIO = 0;
const CHAVE_OU_FIM = 1;
const CHAVE = 2;
const DOIS_PONTOS = 3;
const VALOR = 4;
const CAPTURA = 5;
const DEPOIS_DO_CAMPO = 6;
const ITEM_OU_FIM = 7;
const DEPOIS_DO_ITEM = 8;
const FIM = 9;

const ESPACO = new Set([0x20, 0x0a, 0x0d, 0x09]);

/**
 * Percorre o JSON `{ "campo": valor, "lista": [elem, …], … }` em pedaços de texto. Valida a
 * estrutura do objeto raiz e das listas; cada valor/elemento é validado pelo `JSON.parse`.
 * Lança `JsonIncompleto` se o texto acabar antes do `}` final.
 */
export async function separarJson(
  fatias: AsyncIterable<string>,
  h: ManipuladoresJson,
): Promise<void> {
  let estado = INICIO;
  let chave = '';
  let exigeChave = false; // depois de uma vírgula no objeto raiz
  let exigeItem = false; // depois de uma vírgula numa lista
  let emLista = false; // a captura atual é elemento de lista (senão, valor de campo)
  let indice = 0;
  let partes: string[] = [];
  let nivel = 0;
  let emTexto = false;
  let escape = false;

  for await (const t of fatias) {
    const n = t.length;
    let i = 0;
    let ini = estado === CAPTURA || estado === CHAVE ? 0 : -1;
    let barra = -2; // próxima "\" nesta fatia (-1: não há mais)
    while (i < n) {
      if (estado === CHAVE || estado === CAPTURA) {
        if (emTexto) {
          // Dentro de texto (base64 das fotos): pula direto para a próxima aspa.
          if (escape) {
            escape = false;
            i++;
            continue;
          }
          const aspas = t.indexOf('"', i);
          if (barra !== -1 && barra < i) barra = t.indexOf('\\', i);
          if (barra !== -1 && (aspas === -1 || barra < aspas)) {
            if (barra + 1 < n) i = barra + 2;
            else {
              escape = true;
              i = n;
            }
            continue;
          }
          if (aspas === -1) {
            i = n;
            continue;
          }
          i = aspas + 1;
          emTexto = false;
          if (estado === CHAVE) {
            partes.push(t.slice(ini, i));
            chave = JSON.parse(partes.join('')) as string;
            partes = [];
            ini = -1;
            estado = DOIS_PONTOS;
          }
          continue;
        }
        const c = t.charCodeAt(i);
        if (c === 0x22) {
          emTexto = true;
          i++;
          continue;
        }
        if (nivel === 0 && (c === 0x2c || c === (emLista ? 0x5d : 0x7d))) {
          // Fim do valor/elemento: o delimitador fica para o próximo estado.
          partes.push(t.slice(ini, i));
          const texto = partes.join('');
          partes = [];
          ini = -1;
          let valor: unknown;
          try {
            valor = JSON.parse(texto);
          } catch {
            throw new JsonQuebrado();
          }
          if (emLista) h.elemento(chave, valor, indice++);
          else h.valor(chave, valor);
          estado = emLista ? DEPOIS_DO_ITEM : DEPOIS_DO_CAMPO;
          continue;
        }
        if (c === 0x7b || c === 0x5b) nivel++;
        else if (c === 0x7d || c === 0x5d) {
          if (--nivel < 0) throw new JsonQuebrado();
        }
        i++;
        continue;
      }

      const c = t.charCodeAt(i);
      if (ESPACO.has(c) || (estado === INICIO && c === 0xfeff)) {
        i++;
        continue;
      }
      switch (estado) {
        case INICIO:
          if (c !== 0x7b) throw new JsonQuebrado();
          estado = CHAVE_OU_FIM;
          i++;
          break;
        case CHAVE_OU_FIM:
          if (c === 0x7d && !exigeChave) {
            estado = FIM;
            i++;
            break;
          }
          if (c !== 0x22) throw new JsonQuebrado();
          estado = CHAVE;
          emTexto = true;
          ini = i;
          i++;
          break;
        case DOIS_PONTOS:
          if (c !== 0x3a) throw new JsonQuebrado();
          estado = VALOR;
          i++;
          break;
        case VALOR:
          if (c === 0x5b) {
            h.inicioLista?.(chave);
            estado = ITEM_OU_FIM;
            exigeItem = false;
            indice = 0;
            i++;
            break;
          }
          estado = CAPTURA; // este caractere já é o começo do valor
          emLista = false;
          nivel = 0;
          ini = i;
          break;
        case DEPOIS_DO_CAMPO:
          if (c === 0x2c) {
            estado = CHAVE_OU_FIM;
            exigeChave = true;
          } else if (c === 0x7d) estado = FIM;
          else throw new JsonQuebrado();
          i++;
          break;
        case ITEM_OU_FIM:
          if (c === 0x5d && !exigeItem) {
            estado = DEPOIS_DO_CAMPO;
            i++;
            break;
          }
          estado = CAPTURA;
          emLista = true;
          nivel = 0;
          ini = i;
          break;
        case DEPOIS_DO_ITEM:
          if (c === 0x2c) {
            estado = ITEM_OU_FIM;
            exigeItem = true;
          } else if (c === 0x5d) estado = DEPOIS_DO_CAMPO;
          else throw new JsonQuebrado();
          i++;
          break;
        default: // FIM: nada além de espaços depois do "}" final
          throw new JsonQuebrado();
      }
    }
    if (ini >= 0) partes.push(t.slice(ini));
  }
  if (estado !== FIM) throw new JsonIncompleto();
}

/** Texto do arquivo em fatias (UTF-8 estrito: bytes inválidos = não é um backup). */
async function* textoEmFatias(
  arquivo: Blob,
  tamanho: number,
  aoLer?: (lidos: number, total: number) => void,
): AsyncGenerator<string> {
  const decodificador = new TextDecoder('utf-8', { fatal: true });
  for (let pos = 0; pos < arquivo.size; pos += tamanho) {
    const bytes = new Uint8Array(await arquivo.slice(pos, pos + tamanho).arrayBuffer());
    yield decodificador.decode(bytes, { stream: true });
    aoLer?.(Math.min(pos + tamanho, arquivo.size), arquivo.size);
  }
  const resto = decodificador.decode();
  if (resto) yield resto;
}

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const ORIGENS = new Set(['pcm', 'deduzido', 'manual']);
const MARCAS = new Set(['confere', 'diverge', 'naoTem']);

function blobDe(base64: unknown, tipo: unknown, onde: string): Blob {
  if (!ehTexto(base64)) throw new BackupInvalido(MENSAGEM.estragado(onde));
  try {
    return new Blob([base64ParaBytes(base64) as BlobPart], { type: ehTexto(tipo) ? tipo : '' });
  } catch {
    throw new BackupInvalido(MENSAGEM.estragado(onde));
  }
}

function lerImportacao(v: unknown, k: number): Importacao {
  const onde = `PCM importado ${k + 1}`;
  if (
    !ehObjeto(v) ||
    !ehTexto(v.id) ||
    !ehTexto(v.nomeArquivo) ||
    !ehTexto(v.importadaEm) ||
    !ehNumero(v.tamanho) ||
    !Array.isArray(v.abas) ||
    !v.abas.every(ehTexto)
  )
    throw new BackupInvalido(MENSAGEM.estragado(onde));
  const { arquivoBase64, tipo, ...resto } = v;
  return { ...(resto as Omit<Importacao, 'arquivo'>), arquivo: blobDe(arquivoBase64, tipo, onde) };
}

function lerEquipamento(v: unknown, k: number): TudoDoBanco['equipamentos'][number] {
  if (
    ehObjeto(v) &&
    ehTexto(v.id) &&
    ehTexto(v.aba) &&
    ehNumero(v.linha) &&
    ehTexto(v.nomeOriginal) &&
    ehTexto(v.nome) &&
    (v.tag === null || ehTexto(v.tag)) &&
    ehTexto(v.importacaoId) &&
    ehNumero(v.ordem)
  )
    return v as unknown as TudoDoBanco['equipamentos'][number];
  throw new BackupInvalido(MENSAGEM.estragado(`equipamento ${k + 1}`));
}

function lerItem(v: unknown, k: number): TudoDoBanco['itens'][number] {
  if (
    ehObjeto(v) &&
    ehTexto(v.id) &&
    ehTexto(v.origem) &&
    ORIGENS.has(v.origem) &&
    (v.linha === null || ehNumero(v.linha)) &&
    ehTexto(v.nome) &&
    ehTexto(v.especificacao) &&
    ehTexto(v.quantidade) &&
    ehTexto(v.tipo) &&
    ehTexto(v.equipamentoId) &&
    ehNumero(v.ordem)
  ) {
    // Tipo de item que este app não conhece: backup de uma versão mais nova.
    if (!Object.hasOwn(TEMPLATES, v.tipo)) throw new BackupInvalido(MENSAGEM.versaoNova);
    return v as unknown as TudoDoBanco['itens'][number];
  }
  throw new BackupInvalido(MENSAGEM.estragado(`item ${k + 1}`));
}

function lerMedicao(v: unknown, k: number): TudoDoBanco['medicoes'][number] {
  if (ehMedicao(v) && Object.values(v.valores).every(ehTexto)) {
    const marcas = Object.values(v.conferencia);
    if (marcas.every(ehTexto)) {
      // Marca que este app não conhece: backup de uma versão mais nova.
      if (!marcas.every((m) => MARCAS.has(m))) throw new BackupInvalido(MENSAGEM.versaoNova);
      return v;
    }
  }
  throw new BackupInvalido(MENSAGEM.estragado(`medição ${k + 1}`));
}

function lerNota(v: unknown, k: number): TudoDoBanco['notas'][number] {
  if (ehNota(v)) return v;
  throw new BackupInvalido(MENSAGEM.estragado(`observação de equipamento ${k + 1}`));
}

function lerFoto(v: unknown, k: number): Foto {
  const onde = `foto ${k + 1}`;
  if (
    !ehObjeto(v) ||
    !ehTexto(v.id) ||
    !ehTexto(v.alvoId) ||
    !ehTexto(v.criadaEm) ||
    !ehNumero(v.largura) ||
    !ehNumero(v.altura) ||
    (v.daPlaca !== undefined && typeof v.daPlaca !== 'boolean')
  )
    throw new BackupInvalido(MENSAGEM.estragado(onde));
  const { tipo, base64, miniaturaTipo, miniaturaBase64, ...resto } = v;
  return {
    ...(resto as Omit<Foto, 'blob' | 'miniatura'>),
    blob: blobDe(base64, tipo, onde),
    // Backup sem miniatura (antigo, ou foto antiga): a foto abre pelo blob grande.
    ...(miniaturaBase64 !== undefined && {
      miniatura: blobDe(miniaturaBase64, miniaturaTipo, onde),
    }),
  };
}

const LEITORES = {
  importacoes: lerImportacao,
  equipamentos: lerEquipamento,
  itens: lerItem,
  medicoes: lerMedicao,
  notas: lerNota,
  fotos: lerFoto,
} as const;
type Lista = keyof typeof LEITORES;
const LISTAS = Object.keys(LEITORES) as Lista[];
const ehLista = (chave: string): chave is Lista => Object.hasOwn(LEITORES, chave);

export interface BackupLido {
  versao: number;
  criadoEm: string;
  app: string | null;
  tamanho: number;
  resumo: ResumoBackup;
  tudo: TudoDoBanco;
}

interface OpcoesLeitura {
  /** Bytes lidos até agora. */
  aoProgredir?: (lidos: number, total: number) => void;
  tamanhoFatia?: number;
}

/**
 * Lê e valida o backup inteiro. Lança `BackupInvalido` (com o texto para o técnico) se não for
 * um backup do app, se estiver cortado, estragado ou for de uma versão mais nova.
 */
export async function lerBackup(
  arquivo: Blob,
  { aoProgredir, tamanhoFatia = 1 << 20 }: OpcoesLeitura = {},
): Promise<BackupLido> {
  const cab: Record<string, unknown> = {};
  const tudo: TudoDoBanco = {
    importacaoAtual: null,
    importacoes: [],
    equipamentos: [],
    itens: [],
    medicoes: [],
    notas: [],
    fotos: [],
  };
  const vistas = new Set<Lista>();
  let cabecalhoConferido = false;
  const conferirCabecalho = () => {
    if (cabecalhoConferido) return;
    if (cab.formato !== FORMATO_BACKUP || !ehNumero(cab.versao) || cab.versao < 1)
      throw new BackupInvalido(MENSAGEM.naoEBackup);
    if (cab.versao > VERSAO_BACKUP || (ehNumero(cab.esquemaDb) && cab.esquemaDb > VERSAO_BANCO))
      throw new BackupInvalido(MENSAGEM.versaoNova);
    cabecalhoConferido = true;
  };

  try {
    await separarJson(textoEmFatias(arquivo, tamanhoFatia, aoProgredir), {
      valor(chave, valor) {
        if (ehLista(chave)) throw new BackupInvalido(MENSAGEM.naoEBackup);
        cab[chave] = valor;
        if (chave === 'formato' && valor !== FORMATO_BACKUP)
          throw new BackupInvalido(MENSAGEM.naoEBackup);
      },
      inicioLista(chave) {
        conferirCabecalho(); // "formato" e "versao" vêm antes das listas
        if (!ehLista(chave)) return;
        if (vistas.has(chave)) throw new BackupInvalido(MENSAGEM.estragado(chave));
        vistas.add(chave);
      },
      elemento(chave, valor, k) {
        if (!ehLista(chave)) return; // campo de uma versão futura: ignora
        (tudo[chave] as unknown[]).push(LEITORES[chave](valor, k));
      },
    });
  } catch (e) {
    if (e instanceof BackupInvalido) throw e;
    const conhecido = cab.formato === FORMATO_BACKUP;
    if (e instanceof JsonIncompleto)
      throw new BackupInvalido(conhecido ? MENSAGEM.incompleto : MENSAGEM.naoEBackup);
    if (e instanceof JsonQuebrado || e instanceof TypeError || e instanceof SyntaxError)
      throw new BackupInvalido(
        conhecido
          ? `${MENSAGEM.estragado('estrutura')} ${MENSAGEM.incompleto}`
          : MENSAGEM.naoEBackup,
      );
    throw e; // não conseguiu ler o arquivo (permissão, arquivo apagado no meio…)
  }

  conferirCabecalho();
  if (LISTAS.some((l) => !vistas.has(l))) throw new BackupInvalido(MENSAGEM.incompleto);
  const atual = cab.importacaoAtual;
  if (atual !== null && atual !== undefined) {
    if (!ehTexto(atual) || !tudo.importacoes.some((i) => i.id === atual))
      throw new BackupInvalido(MENSAGEM.estragado('PCM atual'));
    tudo.importacaoAtual = atual;
  }
  const resumo = resumir(tudo);
  if (ehObjeto(cab.resumo)) {
    const declarado = cab.resumo;
    for (const l of LISTAS)
      if (declarado[l] !== undefined && declarado[l] !== resumo[l])
        throw new BackupInvalido(MENSAGEM.incompleto);
  }
  const ids = <T>(lista: readonly T[], id: (r: T) => string, onde: string) => {
    if (new Set(lista.map(id)).size !== lista.length)
      throw new BackupInvalido(MENSAGEM.estragado(`${onde} repetido`));
  };
  ids(tudo.importacoes, (r) => r.id, 'PCM importado');
  ids(tudo.equipamentos, (r) => r.id, 'equipamento');
  ids(tudo.itens, (r) => r.id, 'item');
  ids(tudo.medicoes, (r) => r.itemId, 'medição');
  ids(tudo.notas, (r) => r.equipamentoId, 'observação');
  ids(tudo.fotos, (r) => r.id, 'foto');

  return {
    versao: cab.versao as number,
    criadoEm: ehTexto(cab.criadoEm) ? cab.criadoEm : '',
    app: ehTexto(cab.app) ? cab.app : null,
    tamanho: arquivo.size,
    resumo,
    tudo,
  };
}
