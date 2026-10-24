import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { carregarDados, type Dados } from '../db/repositorio.ts';

interface ContextoDados {
  dados: Dados | null;
  erro: string | null;
  recarregar: () => Promise<void>;
}

const Contexto = createContext<ContextoDados>({
  dados: null,
  erro: null,
  recarregar: async () => {},
});

export function ProvedorDados({ children }: { children: ComponentChildren }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      setDados(await carregarDados());
      setErro(null);
    } catch (e) {
      console.error(e);
      setErro('Não consegui abrir os dados do aparelho. Feche e abra o app de novo.');
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return <Contexto.Provider value={{ dados, erro, recarregar }}>{children}</Contexto.Provider>;
}

export const useDados = () => useContext(Contexto);
