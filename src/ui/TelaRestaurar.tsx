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
import { dataHora } from '../exportar/textos.ts';
import { ArquivoPronto } from './ArquivoPronto.tsx';
import { useDados } from './dados.tsx';
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
          <p class="cartao" role="status">
            Lendo “{estado.nome}”… {estado.pct}%
          </p>
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
          <p class="cartao preparando" role="status">
            Guardando cópia do que está no celular…{' '}
            {estado.total > 0 && `${estado.feitas} de ${estado.total} fotos. `}Não feche o app.
          </p>
        )}

        {estado.etapa === 'gravando' && (
          <p class="cartao preparando" role="status">
            Restaurando… não feche o app.
          </p>
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
              O que estava neste celular antes de restaurar, guardado pelo app (ficam as 2 últimas).
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
  const [apagando, setApagando] = useState(false);
  return (
    <div class="copia">
      <p>
        <strong>Cópia de {dataHora(copia.criadaEm)}</strong>
      </p>
      <button type="button" class="botao botao--grande" onClick={onVoltar}>
        Voltar para esta cópia
      </button>
      <ArquivoPronto arquivo={arquivo} />
      {apagando ? (
        <div class="acoes acoes--pilha">
          {/* "Não" no lugar do "Apagar": tocar de novo no mesmo lugar não apaga. */}
          <button type="button" class="botao botao--secundario" onClick={() => setApagando(false)}>
            Não, manter a cópia
          </button>
          <p class="aviso aviso--bloco aviso--perigo">
            Apagar a cópia de {dataHora(copia.criadaEm)}? Não dá para desfazer.
          </p>
          <button
            type="button"
            class="botao botao--perigo"
            onClick={() => void apagarCopia(copia.chave).then(onApagada)}
          >
            Sim, apagar a cópia
          </button>
        </div>
      ) : (
        <button
          type="button"
          class="botao botao--secundario botao--largo"
          onClick={() => setApagando(true)}
        >
          Apagar esta cópia ({tamanhoLegivel(copia.arquivo.size)})
        </button>
      )}
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
  return (
    <section class="cartao">
      <h2 class="previa-titulo">{nome}</h2>
      <p>
        Backup de <strong>{dataBackup}</strong> ({tamanhoLegivel(lido.tamanho)})
        {pcm && `, PCM “${pcm.nomeArquivo}”`}:
      </p>
      <p>
        <strong>{resumoDoBackup(lido)}</strong>.
      </p>
      {risco ? (
        <div class="aviso aviso--bloco aviso--perigo" role="alert">
          <p>
            ⚠ Este celular tem dados que o backup não tem:{' '}
            {plural(aparelho.medicoes, 'item medido', 'itens medidos')} e{' '}
            {plural(aparelho.fotos, 'foto', 'fotos')}
            {aparelho.ultimaAlteracao && `, o último em ${dataHora(aparelho.ultimaAlteracao)}`}. O
            backup é de {dataBackup}.
          </p>
          <p>Restaurar troca tudo: o que foi feito depois fica só na cópia.</p>
        </div>
      ) : temAqui ? (
        <div class="aviso aviso--bloco">
          <p>
            Este celular tem agora {plural(aparelho.equipamentos, 'equipamento', 'equipamentos')},{' '}
            {plural(aparelho.medicoes, 'item medido', 'itens medidos')} e{' '}
            {plural(aparelho.fotos, 'foto', 'fotos')}. <strong>Tudo será trocado</strong> pelo
            backup. Antes, o app guarda uma cópia.
          </p>
        </div>
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
