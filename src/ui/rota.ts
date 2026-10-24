import { useEffect, useState } from 'preact/hooks';

/** Rotas por hash: funcionam offline e no subcaminho do GitHub Pages sem config de servidor. */
export type Rota = { tela: 'lista' } | { tela: 'importar' } | { tela: 'equipamento'; id: string };

export function lerRota(hash: string): Rota {
  const [, tela, param] = hash.replace(/^#\/?/, '').match(/^([^/]*)\/?(.*)$/) ?? [];
  if (tela === 'importar') return { tela: 'importar' };
  if (tela === 'equipamento' && param)
    return { tela: 'equipamento', id: decodeURIComponent(param) };
  return { tela: 'lista' };
}

export const rotas = {
  lista: '#/',
  importar: '#/importar',
  equipamento: (id: string) => `#/equipamento/${encodeURIComponent(id)}`,
};

export function irPara(hash: string): void {
  if (location.hash !== hash) location.hash = hash;
}

// Histórico: lembra de onde viemos para "voltar" sem empilhar entradas novas.
let hashAnterior: string | null = null;
let hashAtual = typeof location === 'undefined' ? '' : location.hash;
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    hashAnterior = hashAtual;
    hashAtual = location.hash;
  });
}
const mesmaRota = (a: string, b: string) =>
  JSON.stringify(lerRota(a)) === JSON.stringify(lerRota(b));

/**
 * Volta para `destino`. Se viemos de lá, usa history.back() (o "voltar" do Android continua
 * coerente); senão substitui a entrada atual em vez de empilhar outra.
 */
export function voltarPara(destino: string): void {
  if (hashAnterior !== null && mesmaRota(hashAnterior, destino)) history.back();
  else location.replace(destino);
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => lerRota(location.hash));
  useEffect(() => {
    const mudou = () => setRota(lerRota(location.hash));
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return rota;
}
