import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import {
  ErroAoPreparar,
  prepararBackup,
  prepararPlanilha,
  prepararZip,
} from '../exportar/preparar.ts';
import { comTelaAcesa } from '../exportar/telaAcesa.ts';
import { dataCurta, haQuantoTempo } from '../exportar/textos.ts';
import type { UltimoBackup } from '../db/repositorio.ts';
import { ArquivoPronto } from './ArquivoPronto.tsx';
import { useDados } from './dados.tsx';
import {
  IconeAvancar,
  IconeAviso,
  IconeBackup,
  IconeCamera,
  IconeErro,
  IconePlanilha,
  IconeRestaurar,
} from './Icones.tsx';
import { pendenciaDeBackup, textoPendencia, useAgora } from './LinhaBackup.tsx';
import { Progresso } from './Progresso.tsx';
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
 * Uma exportação: "Preparar" gera o arquivo ANTES (com a barra de progresso); só então aparecem
 * "Baixar" e "Compartilhar" (o compartilhar precisa ser chamado direto do toque). `destaque`:
 * o backup, com o botão grande; os outros ficam compactos.
 */
function Exportacao({
  icone,
  titulo,
  extensao,
  texto,
  rotuloPreparar,
  rotuloArquivo,
  unidade,
  destaque = false,
  preparar,
  ocupado,
  setOcupado,
  aoEnviar,
}: {
  icone: ComponentChildren;
  titulo: string;
  extensao: string;
  texto: string;
  rotuloPreparar: string;
  /** "Backup" → "Backup de 26/10 14:30". */
  rotuloArquivo: string;
  /** "fotos": mostra "Preparando… 12 de 300 fotos". */
  unidade?: string;
  destaque?: boolean;
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
    <section class={destaque ? 'cartao exportacao exportacao--destaque' : 'cartao exportacao'}>
      <h2 class="secao-titulo">
        {icone}
        <span>
          {titulo} <span class="extensao">({extensao})</span>
        </span>
      </h2>
      <p class="exportacao-texto">{texto}</p>
      {estado.etapa === 'preparando' ? (
        <Progresso
          texto={
            unidade && estado.total > 0
              ? `Preparando… ${estado.feitas} de ${estado.total} ${unidade}`
              : 'Preparando…'
          }
          feitas={estado.feitas}
          total={unidade ? estado.total : undefined}
          nota="Deixe o app aberto."
        />
      ) : estado.etapa === 'pronto' ? (
        <>
          <ArquivoPronto
            arquivo={estado.arquivo}
            titulo={`${rotuloArquivo} de ${dataCurta(estado.arquivo.lastModified)}`}
            aoEnviar={aoEnviar}
          />
          <button
            type="button"
            class="botao botao--texto botao--largo"
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
              <IconeErro />
              {estado.mensagem}
            </p>
          )}
          <button
            type="button"
            class={destaque ? 'botao botao--grande' : 'botao botao--secundario botao--largo'}
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
  const agora = useAgora();
  // Um arquivo por vez: dois backups de 200 MB juntos pesam num celular fraco.
  const [ocupado, setOcupado] = useState(false);
  const [backup, setBackup] = useState<UltimoBackup | null>(null);
  const ultimo = dados?.ultimoBackup;
  const pendente = dados ? textoPendencia(pendenciaDeBackup(dados, agora)) : null;

  return (
    <>
      <Topo voltar={{ href: rotas.lista, rotulo: 'Lista' }} />
      <main class="tela">
        <h1 class="titulo-tela">Backup e exportar</h1>
        {ultimo ? (
          <p class="estado-backup">
            <strong>Último backup: {haQuantoTempo(ultimo.em, agora)}.</strong>
            {pendente && <span>{pendente}.</span>}
          </p>
        ) : (
          <p class="aviso aviso--bloco estado-backup">
            <strong>
              <IconeAviso />
              Nenhum backup feito ainda.
            </strong>
            {pendente && <span>{pendente}.</span>}
          </p>
        )}

        <Exportacao
          icone={<IconeBackup />}
          titulo="Backup completo"
          extensao=".json"
          texto="Medidas, observações, fotos e o PCM. Serve para restaurar neste ou em outro celular."
          rotuloPreparar="Preparar backup"
          rotuloArquivo="Backup"
          unidade="fotos"
          destaque
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={async (p) => {
            const { arquivo, criadoEm, fotos } = await prepararBackup(p);
            setBackup({ em: criadoEm.toISOString(), fotos });
            return arquivo;
          }}
          aoEnviar={() => backup && void marcarBackup(backup)}
        />

        <h2 class="subtitulo-tela">Outros arquivos</h2>

        <Exportacao
          icone={<IconePlanilha />}
          titulo="PCM atualizado"
          extensao=".xlsx"
          texto="A planilha do PCM com Medido, Confere/Diverge, Observação e Data em cada item."
          rotuloPreparar="Preparar planilha"
          rotuloArquivo="Planilha"
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={() => prepararPlanilha()}
        />

        <Exportacao
          icone={<IconeCamera />}
          titulo="Fotos"
          extensao=".zip"
          texto="Todas as fotos, com nomes como XA-TC-01_MOTOR_1.jpg."
          rotuloPreparar="Preparar fotos"
          rotuloArquivo="Fotos"
          unidade="fotos"
          ocupado={ocupado}
          setOcupado={setOcupado}
          preparar={(p) => prepararZip(p)}
        />

        <a class="link-acao" href={rotas.restaurar}>
          <IconeRestaurar />
          <span>Restaurar um backup</span>
          <IconeAvancar />
        </a>
      </main>
    </>
  );
}
