import { useState } from 'preact/hooks';

export type Tema = 'auto' | 'claro' | 'escuro';
const CHAVE = 'tema';
const PROXIMO: Record<Tema, Tema> = { auto: 'claro', claro: 'escuro', escuro: 'auto' };
export const NOME_TEMA: Record<Tema, string> = {
  auto: 'Automático',
  claro: 'Claro',
  escuro: 'Escuro',
};

/** Preferência só deste aparelho; se o navegador bloquear o armazenamento, fica no automático. */
export function lerTema(): Tema {
  try {
    const t = localStorage.getItem(CHAVE);
    return t === 'claro' || t === 'escuro' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function aplicarTema(tema: Tema): void {
  if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
}

export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState(lerTema);
  return [
    tema,
    () => {
      const novo = PROXIMO[tema];
      aplicarTema(novo);
      setTema(novo);
    },
  ];
}
