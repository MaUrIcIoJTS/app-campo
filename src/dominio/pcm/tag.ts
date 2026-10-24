import { limpar } from '../texto.ts';

/**
 * TAG de equipamento no PCM: três blocos separados por hífen, o último numérico.
 * Formato (exemplos fictícios): XA-TC-04, XB-PV-01, X2-EX-01, SILO-X1-11.
 * Não pega códigos de dois blocos como "ELEV-01" ou "SP-X1" (não são TAG de equipamento).
 */
const RE_TAG = /\b[A-Z][A-Z0-9]{0,4}-[A-Z][A-Z0-9]{0,3}-\d{1,3}\b/g;

export interface NomeComTag {
  /** Primeira TAG da coluna A (algumas linhas têm várias, ex.: silos). */
  tag: string | null;
  /** Nome sem as TAGs e sem separadores sobrando ("TRANSPORTADORA 04 - CAL"). */
  nome: string;
}

export function extrairTag(colunaA: string): NomeComTag {
  const original = limpar(colunaA);
  const tags = original.match(RE_TAG);
  if (!tags) return { tag: null, nome: original };
  const nome = limpar(original.replace(RE_TAG, ' '))
    .replace(/(\s*[;,]\s*)+(?=[;,]|$)/g, '')
    .replace(/^[\s\-–:;,]+|[\s\-–:;,]+$/g, '')
    .replace(/\s+-\s+(?=[([])/g, ' ')
    .trim();
  return { tag: tags[0] ?? null, nome: nome || original };
}
