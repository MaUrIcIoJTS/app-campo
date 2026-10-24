import type { Armazenamento } from '../../src/db/diario.ts';

/** localStorage de mentira, em memória (cada teste tem o seu). */
export function memoria(): Armazenamento {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}
