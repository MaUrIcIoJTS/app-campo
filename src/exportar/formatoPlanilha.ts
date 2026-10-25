/**
 * Aparência do PCM atualizado (.xlsx). A versão gratuita do SheetJS grava valores, larguras e
 * alturas, mas não fontes, bordas nem cores. Aqui o arquivo já gerado é aberto (é um zip; o
 * leitor e o gravador de zip vêm dentro do próprio SheetJS, `XLSX.CFB`), o `styles.xml` ganha
 * fontes, preenchimentos, bordas e quebra de texto, cada célula marcada recebe o seu estilo
 * (atributo `s`) e o cabeçalho fica congelado.
 *
 * Só a aparência muda: valores, mesclagens e abas ficam como estavam, então a reimportação dá o
 * mesmo PCM. Nada aqui pode impedir a exportação: quem chama usa o arquivo sem formato se der erro.
 */
import * as XLSX from 'xlsx';

/**
 * - `titulo`: cabeçalho do PCM (negrito, fundo cinza, borda);
 * - `tituloApp`: cabeçalho das colunas e abas do app (negrito, fundo azul-claro, borda);
 * - `celula`: borda, quebra de texto, alinhado em cima;
 * - `alerta`: como `celula`, em vermelho e negrito ("Diverge…", divergências > 0);
 * - `nota`: texto de apoio em itálico cinza (1ª linha das abas do app).
 */
export type Estilo = 'titulo' | 'tituloApp' | 'celula' | 'alerta' | 'nota';

export interface FormatoDaAba {
  /** Endereço ("V7") → estilo. */
  celulas: Map<string, Estilo>;
  /** Quantas linhas ficam fixas no topo ao rolar (0 = nenhuma). */
  congelarLinhas: number;
}

export const novoFormato = (congelarLinhas = 0): FormatoDaAba => ({
  celulas: new Map(),
  congelarLinhas,
});

const FONTE = '<sz val="12"/><name val="Calibri"/><family val="2"/><scheme val="minor"/>';
const FONTES = [
  `<font><b/>${FONTE.replace('<name', '<color theme="1"/><name')}</font>`, // negrito
  `<font><b/>${FONTE.replace('<name', '<color rgb="FFC00000"/><name')}</font>`, // vermelho
  `<font><i/>${FONTE.replace('<name', '<color rgb="FF595959"/><name')}</font>`, // itálico cinza
];
const preenchido = (rgb: string) =>
  `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
const PREENCHIMENTOS = [preenchido('FFD9D9D9'), preenchido('FFDDEBF7')];
const fina = (lado: string) => `<${lado} style="thin"><color auto="1"/></${lado}>`;
const BORDA = `<border>${['left', 'right', 'top', 'bottom'].map(fina).join('')}<diagonal/></border>`;

/** Os novos `xf` (formato de célula), na ordem de `ESTILOS`. */
function novosXf(fonte: number, preench: number, borda: number): Record<Estilo, string> {
  const xf = (f: number, p: number, b: number, alinhamento: string) =>
    `<xf numFmtId="0" fontId="${f}" fillId="${p}" borderId="${b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${alinhamento}/></xf>`;
  const emCima = 'vertical="top" wrapText="1"';
  const centro = 'vertical="center" wrapText="1"';
  return {
    titulo: xf(fonte, preench, borda, centro),
    tituloApp: xf(fonte, preench + 1, borda, centro),
    celula: xf(0, 0, borda, emCima),
    alerta: xf(fonte + 1, 0, borda, emCima),
    nota: xf(fonte + 2, 0, 0, 'vertical="top"'),
  };
}
const ESTILOS: readonly Estilo[] = ['titulo', 'tituloApp', 'celula', 'alerta', 'nota'];

/** Acrescenta itens a uma lista do styles.xml (`<fonts count="N">…</fonts>`); devolve o 1º índice novo. */
function acrescentar(xml: string, lista: string, itens: readonly string[]): [string, number] {
  const re = new RegExp(`<${lista} count="(\\d+)">([\\s\\S]*?)</${lista}>`);
  const achado = re.exec(xml);
  if (!achado) throw new Error(`styles.xml sem <${lista}>`);
  const antes = Number(achado[1]);
  const novo = `<${lista} count="${antes + itens.length}">${achado[2]}${itens.join('')}</${lista}>`;
  return [xml.replace(re, () => novo), antes];
}

function formatarEstilos(xml: string): [string, Record<Estilo, number>] {
  let fonte, preench, borda, xf;
  [xml, fonte] = acrescentar(xml, 'fonts', FONTES);
  [xml, preench] = acrescentar(xml, 'fills', PREENCHIMENTOS);
  [xml, borda] = acrescentar(xml, 'borders', [BORDA]);
  const novos = novosXf(fonte, preench, borda);
  [xml, xf] = acrescentar(
    xml,
    'cellXfs',
    ESTILOS.map((e) => novos[e]),
  );
  const indice = Object.fromEntries(ESTILOS.map((e, k) => [e, xf + k])) as Record<Estilo, number>;
  return [xml, indice];
}

function formatarAba(xml: string, formato: FormatoDaAba, indice: Record<Estilo, number>): string {
  let saida = xml.replace(
    /<c r="([A-Z]+\d+)"([^>]*?)(\/?)>/g,
    (tag, end: string, attrs: string, fecha: string) => {
      const estilo = formato.celulas.get(end);
      if (!estilo) return tag;
      return `<c r="${end}" s="${indice[estilo]}"${attrs.replace(/\s+s="\d+"/, '')}${fecha}>`;
    },
  );
  const n = formato.congelarLinhas;
  if (n > 0) {
    const topo = `A${n + 1}`;
    const painel = `<pane ySplit="${n}" topLeftCell="${topo}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="${topo}" sqref="${topo}"/>`;
    const antes = saida;
    saida = saida.replace(
      /<sheetView([^>]*?)\/>/,
      (_t, attrs: string) => `<sheetView${attrs}>${painel}</sheetView>`,
    );
    if (saida === antes) throw new Error('aba sem <sheetView/>');
  }
  return saida;
}

interface EntradaZip {
  content: Uint8Array | number[];
  size: number;
}

/**
 * Aplica os formatos ao .xlsx gerado pelo SheetJS. `abas` na ordem das abas do arquivo
 * (`xl/worksheets/sheet1.xml`, `sheet2.xml`…); `undefined` = aba sem formato.
 */
export function formatarXlsx(
  bytes: Uint8Array,
  abas: readonly (FormatoDaAba | undefined)[],
): Uint8Array {
  const zip = XLSX.CFB.read(bytes, { type: 'array' }) as {
    FullPaths: string[];
    FileIndex: EntradaZip[];
  };
  const entrada = (caminho: string): EntradaZip => {
    const k = zip.FullPaths.findIndex((p) => p.endsWith(`/${caminho}`));
    const e = zip.FileIndex[k];
    if (k < 0 || !e?.content) throw new Error(`${caminho} não está no .xlsx`);
    return e;
  };
  const ler = (e: EntradaZip) => new TextDecoder().decode(new Uint8Array(e.content));
  const gravar = (e: EntradaZip, xml: string) => {
    e.content = new TextEncoder().encode(xml);
    e.size = e.content.length; // o gravador de zip pula entradas com size 0
  };

  const estilos = entrada('xl/styles.xml');
  const [xmlEstilos, indice] = formatarEstilos(ler(estilos));
  // Lê e formata tudo antes de gravar: um erro no meio não deixa o zip pela metade.
  const abasFormatadas = abas.map((formato, k) => {
    if (!formato) return null;
    const e = entrada(`xl/worksheets/sheet${k + 1}.xml`);
    return [e, formatarAba(ler(e), formato, indice)] as const;
  });
  gravar(estilos, xmlEstilos);
  for (const a of abasFormatadas) if (a) gravar(a[0], a[1]);

  const saida = XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true }) as
    Uint8Array | number[];
  return saida instanceof Uint8Array ? saida : new Uint8Array(saida);
}

/** Linhas que o texto ocupa numa coluna de `largura` caracteres (estimativa para Calibri 12). */
export function linhasDoTexto(texto: string, largura: number): number {
  return texto
    .split('\n')
    .reduce((s, p) => s + Math.max(1, Math.ceil(p.length / Math.max(1, largura - 2))), 0);
}

/** Altura (pt) de uma linha de Calibri 12 com quebra de texto. */
export const ALTURA_DA_LINHA = 16;
