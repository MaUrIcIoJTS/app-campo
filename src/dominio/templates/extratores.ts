/**
 * Extratores do valor de referência do PCM a partir do texto livre da especificação.
 * Cada função devolve null quando não reconhece — a UI então mostra o texto original.
 */
import { parseNumero, parsePolegadas, polegadasParaMm } from '../numeros.ts';
import { normalizar } from '../texto.ts';

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;

function primeiro(texto: string, re: RegExp): string | null {
  const m = normalizar(texto).match(re);
  return m ? (m.slice(1).find((g) => g !== undefined) ?? null) : null;
}

function primeiroNumero(texto: string, re: RegExp): number | null {
  return parseNumero(primeiro(texto, re));
}

/** Quantidade numérica da coluna D ("4 UNIDADES" → 4, "27 METROS" → 27). */
export const quantidade = (qtd: string) => parseNumero(qtd);

// ---- Tapete -------------------------------------------------------------------------
/** Largura em mm a partir das polegadas (`26"` → 660,4). Ignora frações como `1/4"`. */
export function larguraTapeteMm(espec: string): number | null {
  const pol = primeiro(espec, new RegExp(String.raw`(?<![/\d])(\d{1,2}(?:[.,]\d+)?)\s*["”]`));
  const v = pol ? parsePolegadas(pol) : null;
  return v === null ? null : polegadasParaMm(v);
}
/** Nº de lonas: "2 LONAS", "2L", "EP1000/4". */
export const lonasTapete = (espec: string) =>
  primeiroNumero(espec, /(?:\b(\d)\s*(?:LONAS|L)\b|\bEP\s?\d+\/(\d))/);
/** Coberturas superior × inferior em polegadas, como texto: "3/16 X 1/16". */
export function coberturasTapete(espec: string): string | null {
  const m = normalizar(espec).match(/(\d+\/\d+)"?\s*X\s*(\d+\/\d+)/);
  return m ? `${m[1]} × ${m[2]}` : null;
}
export const espessuraTapeteMm = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`\(${NUM}\s*MM\)`));

// ---- Mancal / eixo -----------------------------------------------------------------
/** Ø do eixo: "EIXO 63", "(ø61X63 EIXO)", "(EIXO 50MM)", "(EIXO 38,14)". */
export const diametroEixo = (espec: string) =>
  primeiroNumero(
    espec,
    new RegExp(
      String.raw`(?:EIXO\s*Ø?\s*${NUM}|Ø\s*(?:\d+(?:[.,]\d+)?\s*X\s*)?${NUM}\s*(?:MM\s*)?EIXO)`,
    ),
  );

// ---- Motor -------------------------------------------------------------------------
export const potenciaCv = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`${NUM}\s*CV\b`));
export const rotacaoRpm = (espec: string) => primeiroNumero(espec, /(\d{3,4})\s*RPM/);

// ---- Redutor -----------------------------------------------------------------------
/** Redução como "1:30"; aceita também "RED 23,42". */
export function reducao(espec: string): string | null {
  const n = normalizar(espec);
  const m =
    n.match(new RegExp(String.raw`1\s*:\s*${NUM}`)) ??
    n.match(new RegExp(String.raw`\bRED\.?\s+${NUM}`));
  return m ? `1:${m[1]}` : null;
}
export const numeroSerie = (espec: string) => primeiro(espec, /SERIE:?\s*([A-Z0-9-]{3,})/);
export function saidaRedutor(espec: string): string | null {
  const n = normalizar(espec);
  if (/VAZADO/.test(n)) return 'Eixo vazado';
  if (/MACICO/.test(n)) return 'Eixo maciço';
  return null;
}

// ---- Correia em V / polia ----------------------------------------------------------
/** Código da correia em V: "A50", "B 50", "C165", "SPB1600" → "B50". */
export function codigoCorreiaV(espec: string): string | null {
  const m = normalizar(espec).match(/\b(SP[ZABC]|[358]V|[ABCDE]X?)\s?(\d{2,4})\b/);
  return m ? `${m[1]}${m[2]}` : null;
}
export const canaisPolia = (espec: string) =>
  primeiroNumero(espec, /(?:\b(\d{1,2})\s*(?:GORNES|CANAIS|CANAL|BORNES)\b|\b(\d)\s?[ABC]\b)/);
export const perfilPolia = (espec: string) =>
  primeiro(espec, /(?:(?:GORNES|CANAIS|CANAL|BORNES)\s+([A-Z]{1,3})\b|\b\d\s?([ABC])\b)/);
/** Ø da polia: número no início ("100 2 GORNES"), "POLIA 190MM" ou "ø220". */
export const diametroPolia = (espec: string) =>
  primeiroNumero(espec, /(?:^(?:POLIA\s*)?(?:Ø\s*)?(\d{2,4})(?:\s*MM)?\b|Ø\s*(\d{2,4}))/);
export const furo = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`FURO\s*Ø?\s*${NUM}`));
export const diametroExterno = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`Ø\s*${NUM}`));

// ---- Tela / cabo / canecas ---------------------------------------------------------
export const malhaTela = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`MALHA\s*${NUM}`));
export const fioTela = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`FIO\s*${NUM}`));
export const diametroCaboMm = (espec: string) =>
  primeiroNumero(espec, new RegExp(String.raw`${NUM}\s*MM\b`));
// ---- Rotor -------------------------------------------------------------------------
/** Ø × largura do rotor: "1700X170", "Ø1300X345L", "ø960/330MM", "800X625 - PALETAS…". */
export function dimensoesRotor(espec: string): [diametro: number, largura: number] | null {
  const m = normalizar(espec).match(new RegExp(String.raw`^\s*Ø?\s*${NUM}\s*[X/]\s*${NUM}`));
  if (!m) return null;
  const d = parseNumero(m[1]);
  const l = parseNumero(m[2]);
  return d !== null && l !== null ? [d, l] : null;
}
/** Nº de pás/paletas, quando o PCM informa ("8 PÁS", "12 PALETAS"). */
export const pasRotor = (espec: string) => primeiroNumero(espec, /\b(\d{1,2})\s*(?:PAS|PALETAS)\b/);

/** Dimensões "155X260X190MM (AXLXP)" → [155, 260, 190]. */
export function dimensoes3(espec: string): [number, number, number] | null {
  const m = normalizar(espec).match(new RegExp(String.raw`${NUM}\s*X\s*${NUM}\s*X\s*${NUM}`));
  if (!m) return null;
  const v = [m[1], m[2], m[3]].map(parseNumero);
  return v.every((x) => x !== null) ? (v as [number, number, number]) : null;
}
