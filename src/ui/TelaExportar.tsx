import { useState } from 'preact/hooks';
import {
  ErroAoPreparar,
  prepararBackup,
  prepararPlanilha,
  prepararZip,
} from '../exportar/preparar.ts';
import { comTelaAcesa } from '../exportar/telaAcesa.ts';
import { haQuantoTempo } from '../exportar/textos.ts';
import type { UltimoBackup } from '../db/repositorio.ts';
import { ArquivoPronto } from './ArquivoPronto.tsx';
import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { Topo } from './Topo.tsx';

type Estado =
  | { etapa: 'inicio' }
  | { etapa: 'preparando'; feitas: number; total: number }
  | { etapa: 'pronto'; arquivo: File }
  | { etapa: 'erro'; mensagem: string };

type Preparar = (aoProgredir: (feitas: number, total: number) => void) => Promise<File>;

const ERRO_GERAL = 'Não consegui preparar o arquivo. Feche e abra o app e tente de novo.';

/**
 * Uma exportação: "Preparar" gera o arquivo ANTES (com "Preparando…"); só então aparecem
 * "Baixar" e "Compartilhar" (o compartilhar precisa ser chamado direto do toque).
 */
function Exportacao({
  titulo,
  texto,
  rotuloPreparar,
  unidade,
  preparar,
  ocupado,
  setOcupado,
  aoEnviar,
}: {
  titulo: string;
  texto: string;
  rotuloPreparar: string;
  /** "fotos": mostra "Preparando… 12 de 300 fotos". */
  unidade?: string;
  preparar: Preparar;
  ocupado: boolean;
  setOcupado: (b: boolean) => void;
  aoEnviar?: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ etapa: 'inicio' });

  async function tocar() {
    if (ocupado) return;
    setOcupado(true);
    setEstado({ etapa: 'preparando', feitas: 0, total: 0 });
    try {
      const arquivo = await comTelaAcesa(() =>
        preparar((feitas, total) => setEstado({ etapa: 'preparando', feitas, total })),
      );
      setEstado({ etapa: 'pronto', arquivo });
    } catch (e) {
      console.error(e);
      setEstado({ etapa: 'erro', mensagem: e instanceof ErroAoPreparar ? e.message : ERRO_GERAL });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section class="cartao">
      <h2 class="secao-titulo">{titulo}</h2>
      <p class="suave">{texto}</p>
      {estado.etapa === 'preparando' ? (
        <p class="preparando" role="status">
          Preparando…
          {unidade && estado.total > 0 && ` ${estado.feitas} de ${estado.total} ${unidade}`}
        </p>
      ) : estado.etapa === 'pronto' ? (
        <>
          <ArquivoPronto arquivo={estado.arquivo} aoEnviar={aoEnviar} />
          <button
            type="button"
            class="botao botao--secundario botao--largo"
            disabled={ocupado}
            onClick={() => void tocar()}
          >
            Preparar de novo
          </button>
        </>
      ) : (
        <>
          {estado.etapa === 'erro' && (
            <p class="erro" role="alert">
              ⚠ {estado.mensagem}
            </p>
          )}
          <button
            type="button"
            class="botao botao--grande"
            disabled={ocupado}
            onClick={() => void tocar()}
          >
            {rotuloPreparar}
          </button>
        </>
      )}
    </section>
  );
}

export function TelaExportar() {
  const { dados, marcarBackup } = useDados();
  // Um arquivo por vez: dois backups de 200 MB juntos pesam num celular fraco.
  const [ocupado, setOcupado] = useState(false);
  const [backup, setBackup] = useState<UltimoBackup | null>(null);
  const ultimo = dados?.ultimoBackup;

  return (
    <>
      <Topo voltar={{ href: rotas.lista, rotulo: 'Lista' }} />
      <main class="tela">
        <h1 class="titulo-tela">Backup e exportar</h1>
        <p class={ultimo ? 'suave' : 'aviso aviso--bloco'}>
          {ultimo ? `Último backup: ${haQuantoTempo(ultimo.em)}.` : 'Nenhum backup feito ainda.'}
        </p>

        <Exportacao
          titulo="Backup completo (.json)"
          texto="Medidas, observações, fotos e o PCM. Serve para restaurar neste ou em outro celular."
          rotuloPreparar="Preparar backup"
          unidade="fotos"
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={async (p) => {
            const { arquivo, criadoEm, fotos } = await prepararBackup(p);
            setBackup({ em: criadoEm.toISOString(), fotos });
            return arquivo;
          }}
          aoEnviar={() => backup && void marcarBackup(backup)}
        />

        <Exportacao
          titulo="PCM atualizado (.xlsx)"
          texto="A planilha do PCM com as colunas Medido, Confere/Diverge, Observação e Data, e as abas Resumo e Fora do PCM."
          rotuloPreparar="Preparar planilha"
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={() => prepararPlanilha()}
        />

        <Exportacao
          titulo="Fotos (.zip)"
          texto="Todas as fotos, com nomes como XA-TC-01_MOTOR_1.jpg."
          rotuloPreparar="Preparar fotos"
          unidade="fotos"
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={(p) => prepararZip(p)}
        />

        <section class="cartao">
          <h2 class="secao-titulo">Restaurar backup</h2>
          <p class="suave">Troca os dados deste celular pelos de um backup.</p>
          <a class="botao botao--secundario botao--largo" href={rotas.restaurar}>
            Restaurar backup…
          </a>
        </section>
      </main>
    </>
  );
}
