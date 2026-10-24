import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { chaveDoDiario } from '../db/diario.ts';
import {
  lerRegistro,
  maisNovo,
  pendentesMaisNovos,
  reaplicarDiario,
  registrarMedicao,
  registrarNota,
} from '../db/edicao.ts';
import type { Medicao } from '../db/esquema.ts';
import { carregarDados, type Dados } from '../db/repositorio.ts';
import { filaDeGravacao } from '../db/salvamento.ts';
import { novaNota } from '../dominio/medicao.ts';

interface ContextoDados {
  dados: Dados | null;
  erro: string | null;
  recarregar: () => Promise<void>;
  /** Edição da medição: tela e diário na hora, IndexedDB em até ~300 ms. */
  alterarMedicao: (itemId: string, mudar: (atual: Medicao | undefined) => Medicao) => void;
  alterarNota: (equipamentoId: string, observacao: string) => void;
}

const Contexto = createContext<ContextoDados>({
  dados: null,
  erro: null,
  recarregar: async () => {},
  alterarMedicao: () => {},
  alterarNota: () => {},
});

/**
 * O que o banco não confirmou (ainda no diário e mais novo) vai para a tela e de novo para a
 * fila — que tenta gravar e mostra "⚠ Não salvou" se o banco continuar recusando.
 */
function comPendentesDoDiario(d: Dados): Dados {
  const pendentes = pendentesMaisNovos(d.medicoes, d.notas);
  if (pendentes.medicoes.length === 0 && pendentes.notas.length === 0) return d;
  const medicoes = new Map(d.medicoes);
  const notas = new Map(d.notas);
  for (const m of pendentes.medicoes) {
    medicoes.set(m.itemId, m);
    registrarMedicao(m);
  }
  for (const n of pendentes.notas) {
    notas.set(n.equipamentoId, n);
    registrarNota(n);
  }
  return { ...d, medicoes, notas };
}

export function ProvedorDados({ children }: { children: ComponentChildren }) {
  const [dados, setEstado] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Edições seguidas (antes de redesenhar) partem sempre da versão mais nova, não da renderizada.
  const atualRef = useRef<Dados | null>(null);
  const setDados = useCallback((d: Dados) => {
    atualRef.current = d;
    setEstado(d);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      await filaDeGravacao.descarregar(); // o banco tem que ter o que está na tela
      setDados(comPendentesDoDiario(await carregarDados()));
      setErro(null);
    } catch (e) {
      console.error(e);
      setErro('Não consegui abrir os dados do aparelho. Feche e abra o app de novo.');
    }
  }, [setDados]);

  useEffect(() => {
    void (async () => {
      try {
        await reaplicarDiario(); // o que o Android matou antes de chegar ao banco
      } catch (e) {
        console.error('Diário não reaplicado (fica para a próxima abertura)', e);
      }
      await recarregar();
    })();
  }, [recarregar]);

  // App aberto em duas janelas (ícone + aba do Chrome): cada edição da outra chega pelo
  // diário. Sem isto, a próxima edição aqui gravaria o item inteiro sem o campo dela.
  useEffect(() => {
    const deOutraJanela = (e: StorageEvent) => {
      const chave = chaveDoDiario(e.key);
      const d = atualRef.current;
      if (!chave || !e.newValue || !d) return;
      let valor: unknown;
      try {
        valor = JSON.parse(e.newValue);
      } catch {
        return;
      }
      const r = lerRegistro(chave, valor);
      if (r?.tipo === 'medicao' && maisNovo(r.valor, d.medicoes.get(r.valor.itemId)))
        setDados({ ...d, medicoes: new Map(d.medicoes).set(r.valor.itemId, r.valor) });
      if (r?.tipo === 'nota' && maisNovo(r.valor, d.notas.get(r.valor.equipamentoId)))
        setDados({ ...d, notas: new Map(d.notas).set(r.valor.equipamentoId, r.valor) });
    };
    window.addEventListener('storage', deOutraJanela);
    return () => window.removeEventListener('storage', deOutraJanela);
  }, [setDados]);

  const alterarMedicao = useCallback(
    (itemId: string, mudar: (m: Medicao | undefined) => Medicao) => {
      const d = atualRef.current;
      if (!d) return;
      const nova = mudar(d.medicoes.get(itemId));
      registrarMedicao(nova);
      setDados({ ...d, medicoes: new Map(d.medicoes).set(itemId, nova) });
    },
    [setDados],
  );

  const alterarNota = useCallback(
    (equipamentoId: string, observacao: string) => {
      const d = atualRef.current;
      if (!d) return;
      const nota = novaNota(equipamentoId, observacao, d.notas.get(equipamentoId));
      registrarNota(nota);
      setDados({ ...d, notas: new Map(d.notas).set(equipamentoId, nota) });
    },
    [setDados],
  );

  const valor = useMemo(
    () => ({ dados, erro, recarregar, alterarMedicao, alterarNota }),
    [dados, erro, recarregar, alterarMedicao, alterarNota],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useDados = () => useContext(Contexto);
