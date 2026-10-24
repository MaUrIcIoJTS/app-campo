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

export function useRota(): Rota {
  const [rota, setRota] = useState(() => lerRota(location.hash));
  useEffect(() => {
    const mudou = () => setRota(lerRota(location.hash));
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return rota;
}
