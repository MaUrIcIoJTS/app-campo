import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  apagarCopia,
  contarDoAparelho,
  lerCopias,
  type ContagemDoAparelho,
  type CopiaAntesDeRestaurar,
} from '../db/repositorio.ts';
import { tamanhoLegivel } from '../exportar/compartilhar.ts';
import { BackupInvalido, lerBackup, type BackupLido } from '../exportar/lerBackup.ts';
import { MIME } from '../exportar/nomes.ts';
import {
  ErroAoRestaurar,
  MENSAGEM_RESTAURAR,
  prontoParaRestaurar,
  restaurarBackup,
} from '../exportar/restaurar.ts';
import { dataCurta, dataHora } from '../exportar/textos.ts';
import { AvisoBaixado, CabecalhoArquivo, LinkBaixar, useUrl } from './ArquivoPronto.tsx';
import { useDados } from './dados.tsx';
import { Progresso } from './Progresso.tsx';
import { rotas } from './rota.ts';
import { Topo } from './Topo.tsx';

type Estado =
  | { etapa: 'escolher' }
  | { etapa: 'lendo'; nome: string; pct: number }
  | { etapa: 'previa'; lido: BackupLido; nome: string; aparelho: ContagemDoAparelho }
  | { etapa: 'copiando'; feitas: number; total: number }
  | { etapa: 'gravando' }
  | { etapa: 'feito'; lido: BackupLido }
  | { etapa: 'erro'; mensagem: string };

type Copia = CopiaAntesDeRestaurar & { chave: string };

const ERRO_LEITURA =
  'Não consegui ler este arquivo. Ele ainda está no celular? Baixe de novo e tente outra vez.';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function TelaRestaurar() {
  const { recarregar } = useDados();
  const [estado, setEstado] = useState<Estado>({ etapa: 'escolher' });
  const [copias, setCopias] = useState<Copia[]>([]);
  // Trava já no 1º toque: um 2º toque de luva não dispara outra restauração.
  const travadoRef = useRef(false);
  const erro = (mensagem: string) => setEstado({ etapa: 'erro', mensagem });
  const ocupado = estado.etapa === 'copiando' || estado.etapa === 'gravando';

  const atualizarCopias = () =>
    void lerCopias()
      .then(setCopias)
      .catch(() => {});
  useEffect(atualizarCopias, []);

  // Restaurando: o "voltar" do Android não sai desta tela (o app também só mostra esta tela).
  useEffect(() => {
    if (!ocupado) return;
    const ficar = () => {
      if (location.hash !== rotas.restaurar) location.replace(rotas.restaurar);
    };
    window.addEventListener('hashchange', ficar);
    return () => window.removeEventListener('hashchange', ficar);
  }, [ocupado]);

  async function abrir(arquivo: Blob, nome: string) {
    if (!(await prontoParaRestaurar())) return erro(MENSAGEM_RESTAURAR.pendente);
    setEstado({ etapa: 'lendo', nome, pct: 0 });
    try {
      const lido = await lerBackup(arquivo, {
        aoProgredir: (lidos, total) =>
          setEstado({ etapa: 'lendo', nome, pct: Math.floor((100 * lidos) / total) }),
      });
      setEstado({ etapa: 'previa', lido, nome, aparelho: await contarDoAparelho() });
    } catch (e) {
      console.error(e);
      erro(e instanceof BackupInvalido ? `${e.message} Nada foi alterado.` : ERRO_LEITURA);
    }
  }

  async function escolheu(input: HTMLInputElement) {
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (arquivo) await abrir(arquivo, arquivo.name);
  }

  async function confirmar(lido: BackupLido) {
    if (travadoRef.current) return;
    travadoRef.current = true;
    setEstado({ etapa: 'gravando' });
    try {
      await restaurarBackup(lido, (e) =>
        setEstado(e.etapa === 'copiando' ? { ...e } : { etapa: 'gravando' }),
      );
      await recarregar();
      setEstado({ etapa: 'feito', lido });
    } catch (e) {
      console.error(e);
      erro(e instanceof ErroAoRestaurar ? e.message : MENSAGEM_RESTAURAR.gravar);
    } finally {
      travadoRef.current = false;
      atualizarCopias();
    }
  }

  return (
    <>
      <Topo
        voltar={ocupado ? undefined : { href: rotas.lista, rotulo: 'Lista' }}
        titulo={{ curto: 'Restaurando…', completo: 'Restaurando o backup' }}
      />
      <main class="tela">
        <h1 class="titulo-tela">Restaurar backup</h1>

        {estado.etapa === 'escolher' && (
          <section class="cartao">
            <p>
              Troca <strong>todos</strong> os dados deste celular pelos do backup. Antes, o app
              guarda uma cópia do que está aqui.
            </p>
            <p class="suave">
              Procure “levantamento-backup-….json” em Downloads. Veio pelo WhatsApp? Abra a conversa
              e toque no arquivo para baixar antes.
            </p>
            <BotaoBackup onEscolher={escolheu} />
          </section>
        )}

        {estado.etapa === 'lendo' && (
          <section class="cartao">
            <p class="arquivo-nome">{estado.nome}</p>
            <Progresso texto={`Lendo o backup… ${estado.pct}%`} feitas={estado.pct} total={100} />
          </section>
        )}

        {estado.etapa === 'previa' && (
          <Previa
            lido={estado.lido}
            nome={estado.nome}
            aparelho={estado.aparelho}
            onConfirmar={() => void confirmar(estado.lido)}
            onCancelar={() => setEstado({ etapa: 'escolher' })}
          />
        )}

        {estado.etapa === 'copiando' && (
          <section class="cartao">
            <Progresso
              texto={
                estado.total > 0
                  ? `Guardando cópia do que está no celular… ${estado.feitas} de ${estado.total} fotos`
                  : 'Guardando cópia do que está no celular…'
              }
              feitas={estado.feitas}
              total={estado.total || undefined}
              nota="Não feche o app."
            />
          </section>
        )}

        {estado.etapa === 'gravando' && (
          <section class="cartao">
            <Progresso texto="Restaurando…" nota="Não feche o app." />
          </section>
        )}

        {estado.etapa === 'feito' && (
          <section class="cartao">
            <p class="ok" role="status">
              ✓ Backup restaurado: {resumoDoBackup(estado.lido)}.
            </p>
            <a class="botao botao--grande" href={rotas.lista}>
              Ir para a lista
            </a>
          </section>
        )}

        {estado.etapa === 'erro' && (
          <section class="cartao">
            <p class="erro" role="alert">
              ⚠ {estado.mensagem}
            </p>
            <BotaoBackup onEscolher={escolheu} rotulo="Escolher outro arquivo" />
          </section>
        )}

        {copias.length > 0 && !ocupado && estado.etapa !== 'lendo' && estado.etapa !== 'previa' && (
          <section class="cartao">
            <h2 class="secao-titulo">
              {copias.length === 1
                ? 'Cópia de antes da restauração'
                : 'Cópias de antes das restaurações'}
            </h2>
            <p class="suave">
              O que estava neste celular antes de restaurar. O app guarda as 2 últimas.
            </p>
            {copias.map((c) => (
              <CopiaGuardada
                key={c.chave}
                copia={c}
                onVoltar={() => void abrir(c.arquivo, c.nome)}
                onApagada={atualizarCopias}
              />
            ))}
          </section>
        )}
      </main>
    </>
  );
}

/** Uma cópia: "Restaurar esta cópia" em destaque; embaixo, Baixar e Apagar lado a lado. */
function CopiaGuardada({
  copia,
  onVoltar,
  onApagada,
}: {
  copia: Copia;
  onVoltar: () => void;
  onApagada: () => void;
}) {
  const arquivo = useMemo(
    () => new File([copia.arquivo], copia.nome, { type: MIME.json }),
    [copia],
  );
  const url = useUrl(arquivo);
  const [apagando, setApagando] = useState(false);
  const [erroAoApagar, setErroAoApagar] = useState(false);
  const [baixadoEm, setBaixadoEm] = useState<Date | null>(null);
  return (
    <div class="copia">
      <CabecalhoArquivo titulo={`Cópia de ${dataCurta(copia.criadaEm)}`} arquivo={arquivo} />
      <button type="button" class="botao botao--grande botao--largo" onClick={onVoltar}>
        Restaurar esta cópia
      </button>
      {apagando ? (
        <div class="acoes acoes--pilha">
          {/* "Não" no lugar do "Apagar": tocar de novo no mesmo lugar não apaga. */}
          <button type="button" class="botao botao--secundario" onClick={() => setApagando(false)}>
            Não, manter a cópia
          </button>
          <p class="aviso aviso--bloco aviso--perigo">
            Apagar a cópia de {dataHora(copia.criadaEm)} ({tamanhoLegivel(copia.arquivo.size)})? Não
            dá para desfazer.
          </p>
          <button
            type="button"
            class="botao botao--perigo"
            onClick={() =>
              void apagarCopia(copia.chave)
                .then(onApagada)
                .catch((e: unknown) => {
                  console.error('Cópia não apagada', e);
                  setErroAoApagar(true);
                })
            }
          >
            Sim, apagar a cópia
          </button>
        </div>
      ) : (
        <div class="acoes acoes--linha">
          <LinkBaixar
            url={url}
            arquivo={arquivo}
            classe="botao botao--secundario"
            rotulo="Baixar"
            onBaixou={() => setBaixadoEm(new Date())}
          />
          <button
            type="button"
            class="botao botao--secundario botao--perigo-contorno"
            onClick={() => setApagando(true)}
          >
            Apagar
          </button>
        </div>
      )}
      {erroAoApagar && (
        <p class="erro" role="alert">
          ⚠ Não consegui apagar a cópia. Ela continua guardada.
        </p>
      )}
      {baixadoEm && <AvisoBaixado em={baixadoEm} />}
    </div>
  );
}

function resumoDoBackup({ resumo }: BackupLido): string {
  return [
    plural(resumo.equipamentos, 'equipamento', 'equipamentos'),
    plural(resumo.medicoes, 'item medido', 'itens medidos'),
    plural(resumo.notas, 'observação de equipamento', 'observações de equipamento'),
    plural(resumo.fotos, 'foto', 'fotos'),
  ].join(', ');
}

/**
 * Sem `accept`: o Android esconde no seletor o .json que chega pelo WhatsApp marcado como
 * "binário". O conteúdo é conferido depois. Sempre <label> + <input>, nunca .click().
 */
function BotaoBackup({
  onEscolher,
  rotulo = 'Escolher arquivo do backup',
}: {
  onEscolher: (input: HTMLInputElement) => void;
  rotulo?: string;
}) {
  return (
    <label class="botao botao--grande">
      <input type="file" class="oculto" onChange={(e) => void onEscolher(e.currentTarget)} />
      {rotulo}
    </label>
  );
}

/** O celular tem algo que o backup não tem (mais novo, ou mais medidas/fotos)? */
function arriscado(lido: BackupLido, aparelho: ContagemDoAparelho): boolean {
  const backup = Date.parse(lido.criadoEm);
  const ultima = aparelho.ultimaAlteracao ? Date.parse(aparelho.ultimaAlteracao) : NaN;
  return (
    (Number.isFinite(ultima) && (!Number.isFinite(backup) || ultima > backup)) ||
    aparelho.medicoes > lido.resumo.medicoes ||
    aparelho.fotos > lido.resumo.fotos
  );
}

interface LinhaDaPrevia {
  rotulo: string;
  backup: string;
  aqui: string;
  /** O celular tem mais (ou mais novo) que o backup: em vermelho. */
  mais: boolean;
}

function linhasDaPrevia(lido: BackupLido, aparelho: ContagemDoAparelho): LinhaDaPrevia[] {
  const r = lido.resumo;
  const backup = Date.parse(lido.criadoEm);
  const ultima = aparelho.ultimaAlteracao ? Date.parse(aparelho.ultimaAlteracao) : NaN;

  const n = (backup: number, aqui: number, mais = aqui > backup) => ({
    backup: String(backup),
    aqui: String(aqui),
    mais,
  });
  return [
    {
      rotulo: 'Dados até',
      backup: dataCurta(lido.criadoEm) || '?',
      aqui: aparelho.ultimaAlteracao ? dataCurta(aparelho.ultimaAlteracao) : '—',
      mais: Number.isFinite(ultima) && (!Number.isFinite(backup) || ultima > backup),
    },
    { rotulo: 'Equipamentos', ...n(r.equipamentos, aparelho.equipamentos, false) },
    { rotulo: 'Itens medidos', ...n(r.medicoes, aparelho.medicoes) },
    { rotulo: 'Obs. de equipamento', ...n(r.notas, aparelho.notas, false) },
    { rotulo: 'Fotos', ...n(r.fotos, aparelho.fotos) },
  ];
}

/**
 * Confere antes de restaurar: tabela "Backup × Este celular" (o que o celular tem a mais fica
 * em vermelho) e os botões. Com risco, 2ª confirmação com o "Não" no lugar do botão tocado.
 */
function Previa({
  lido,
  nome,
  aparelho,
  onConfirmar,
  onCancelar,
}: {
  lido: BackupLido;
  nome: string;
  aparelho: ContagemDoAparelho;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const pcm = lido.tudo.importacoes.find((i) => i.id === lido.tudo.importacaoAtual);
  const temAqui = aparelho.importacoes + aparelho.medicoes + aparelho.notas + aparelho.fotos > 0;
  const risco = temAqui && arriscado(lido, aparelho);
  const dataBackup = dataHora(lido.criadoEm) || 'data desconhecida';
  const linhas = linhasDaPrevia(lido, aparelho);
  return (
    <section class="cartao">
      <h2 class="secao-titulo">Confira antes de restaurar</h2>
      <p class="arquivo-nome">
        {nome} · {tamanhoLegivel(lido.tamanho)}
      </p>
      {pcm && (
        <p class="previa-pcm">
          PCM: <strong>{pcm.nomeArquivo}</strong>
        </p>
      )}
      <div class="tabela-rolagem">
        <table class="tabela tabela--comparar">
          <thead>
            <tr>
              <th scope="col">
                <span class="oculto">O quê</span>
              </th>
              <th scope="col">Backup</th>
              {temAqui && <th scope="col">Este celular</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                <td>{l.backup}</td>
                {temAqui && (
                  <td class={l.mais ? 'mais' : undefined}>
                    {l.mais && <span aria-hidden="true">⚠ </span>}
                    {l.aqui}
                    {l.mais && (
                      <span class="mais-nota">
                        {l.rotulo === 'Dados até' ? 'mais novo' : 'a mais'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {risco ? (
        <div class="aviso aviso--bloco aviso--perigo" role="alert">
          <p>⚠ Este celular tem dados que o backup não tem (em vermelho).</p>
          <p>Restaurar troca tudo: o que foi feito depois de {dataBackup} fica só na cópia.</p>
        </div>
      ) : temAqui ? (
        <p class="aviso aviso--bloco">
          <strong>Tudo neste celular será trocado</strong> pelo backup. Antes, o app guarda uma
          cópia.
        </p>
      ) : (
        <p class="suave">Este celular está vazio.</p>
      )}
      <div class="acoes acoes--pilha">
        {confirmando ? (
          <>
            {/* "Não" no lugar do "Restaurar": tocar de novo no mesmo lugar não restaura. */}
            <button type="button" class="botao botao--grande" onClick={onCancelar}>
              Não, manter os dados deste celular
            </button>
            <p class="aviso aviso--bloco aviso--perigo">
              Tem certeza? O que foi feito depois de {dataBackup} sai deste celular.
            </p>
            <button type="button" class="botao botao--perigo" onClick={onConfirmar}>
              Sim, trocar tudo pelo backup
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              class="botao botao--grande"
              onClick={() => (risco ? setConfirmando(true) : onConfirmar())}
            >
              Restaurar este backup
            </button>
            <button type="button" class="botao botao--secundario" onClick={onCancelar}>
              Cancelar
            </button>
          </>
        )}
      </div>
    </section>
  );
}
