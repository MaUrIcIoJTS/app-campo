import { useState } from 'preact/hooks';
import type { Pcm } from '../dominio/tipos.ts';
import {
  DadosMudaramDuranteImportacao,
  gravarImportacao,
  previaImportacao,
  type ImportacaoResumo,
  type PreviaImportacao,
} from '../db/repositorio.ts';
import { registrosNoDiario } from '../db/edicao.ts';
import { emOperacaoCritica, filaDeGravacao, semRecarregarDurante } from '../db/salvamento.ts';
import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { Topo } from './Topo.tsx';
import { IconeAviso, IconeErro } from './Icones.tsx';

type Previa = { etapa: 'previa'; arquivo: File; pcm: Pcm; previa: PreviaImportacao; id: string };
type Etapa =
  | { etapa: 'escolher' }
  | { etapa: 'lendo'; nome: string }
  | Previa
  | { etapa: 'gravando' }
  | { etapa: 'erro'; mensagem: string };

const ACEITA =
  '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ERRO = {
  pendente:
    'Ainda há medidas ou fotos sendo salvas no aparelho. Espere aparecer “Salvo no aparelho” e tente de novo.',
  app: 'Uma parte do app não carregou. Abra o app uma vez com internet e tente de novo.',
  arquivo: 'Não consegui ler este arquivo. Ele abre no Excel? Tente salvar de novo como .xlsx.',
  vazio: 'Não achei equipamentos nesta planilha. Confira se é o arquivo do PCM.',
  aparelho: 'Não consegui ler os dados do aparelho. Feche e abra o app de novo.',
  gravar: 'Não consegui gravar no aparelho. Nada foi alterado. Verifique o espaço livre.',
  mudou: 'As medidas mudaram enquanto você conferia. Nada foi alterado. Escolha o arquivo de novo.',
};

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function TelaImportar({ onImportado }: { onImportado: (mensagem: string) => void }) {
  const { dados, recarregar } = useDados();
  const [estado, setEstado] = useState<Etapa>({ etapa: 'escolher' });
  const erro = (mensagem: string) => setEstado({ etapa: 'erro', mensagem });

  async function escolheu(input: HTMLInputElement) {
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setEstado({ etapa: 'lendo', nome: arquivo.name });

    // Medidas na fila entram no plano; se não gravaram, não dá para importar com segurança.
    // O diário também: a importação remapeia ids e a entrada iria para um id velho. Idem
    // para uma foto ainda gravando (iria para o id velho do item).
    await filaDeGravacao.descarregar();
    if (filaDeGravacao.pendentes() > 0 || registrosNoDiario().length > 0 || emOperacaoCritica())
      return erro(ERRO.pendente);

    let lerPcm: (dados: ArrayBuffer) => Pcm;
    try {
      // SheetJS é pesado: só carrega aqui (e já está no cache offline).
      ({ lerPcm } = await import('../dominio/pcm/parser.ts'));
    } catch (e) {
      console.error(e);
      return erro(ERRO.app);
    }

    let pcm: Pcm;
    try {
      pcm = lerPcm(await arquivo.arrayBuffer());
    } catch (e) {
      console.error(e);
      return erro(ERRO.arquivo);
    }
    if (pcm.abas.every((a) => a.equipamentos.length === 0)) return erro(ERRO.vazio);

    const id = `imp-${Date.now()}`;
    try {
      setEstado({ etapa: 'previa', arquivo, pcm, previa: await previaImportacao(pcm, id), id });
    } catch (e) {
      console.error(e);
      erro(ERRO.aparelho);
    }
  }

  async function confirmar(e: Previa) {
    setEstado({ etapa: 'gravando' });
    await filaDeGravacao.descarregar(); // de novo: pode ter chegado edição de outra janela
    if (filaDeGravacao.pendentes() > 0 || registrosNoDiario().length > 0 || emOperacaoCritica())
      return erro(ERRO.pendente);
    try {
      await semRecarregarDurante(() =>
        gravarImportacao(
          {
            id: e.id,
            nomeArquivo: e.arquivo.name,
            importadaEm: new Date().toISOString(),
            tamanho: e.arquivo.size,
            abas: e.pcm.abas.map((a) => a.nome),
            arquivo: e.arquivo,
          },
          e.previa,
        ),
      );
      await recarregar();
      onImportado(`PCM importado: ${e.previa.plano.resumo.equipamentos} equipamentos.`);
    } catch (falha) {
      console.error(falha);
      erro(falha instanceof DadosMudaramDuranteImportacao ? ERRO.mudou : ERRO.gravar);
    }
  }

  return (
    <>
      <Topo voltar={{ href: rotas.lista, rotulo: 'Lista' }} />
      <main class="tela">
        <h1 class="titulo-tela">{dados?.importacao ? 'Trocar o PCM' : 'Importar PCM'}</h1>

        {estado.etapa === 'escolher' && (
          <section class="cartao">
            {dados?.importacao ? (
              <p>
                PCM atual: <strong>{dados.importacao.nomeArquivo}</strong>, de{' '}
                {dataCurta(dados.importacao.importadaEm)}. Suas medidas e fotos são mantidas.
              </p>
            ) : (
              <p>Escolha a planilha do PCM (.xls ou .xlsx). Os dados ficam só neste aparelho.</p>
            )}
            <BotaoArquivo onEscolher={escolheu} />
          </section>
        )}

        {estado.etapa === 'lendo' && (
          <p class="cartao" role="status">
            Lendo “{estado.nome}”…
          </p>
        )}

        {estado.etapa === 'previa' && (
          <Previa estado={estado} atual={dados?.importacao ?? null} onConfirmar={confirmar} />
        )}

        {estado.etapa === 'gravando' && (
          <p class="cartao" role="status">
            Gravando no aparelho… não feche o app.
          </p>
        )}

        {estado.etapa === 'erro' && (
          <section class="cartao">
            <p class="erro" role="alert">
              <IconeErro />
              {estado.mensagem}
            </p>
            <BotaoArquivo onEscolher={escolheu} rotulo="Escolher arquivo de novo" />
          </section>
        )}
      </main>
    </>
  );
}

/** Arquivos (e câmera) SEMPRE por <label> + <input>: nunca .click() programático. */
function BotaoArquivo({
  onEscolher,
  rotulo = 'Escolher arquivo do PCM',
}: {
  onEscolher: (input: HTMLInputElement) => void;
  rotulo?: string;
}) {
  return (
    <label class="botao botao--grande">
      <input
        type="file"
        accept={ACEITA}
        class="oculto"
        onChange={(e) => void onEscolher(e.currentTarget)}
      />
      {rotulo}
    </label>
  );
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Previa({
  estado,
  atual,
  onConfirmar,
}: {
  estado: Previa;
  atual: ImportacaoResumo | null;
  onConfirmar: (e: Previa) => void;
}) {
  const { pcm, previa, arquivo } = estado;
  const { existentes, plano } = previa;
  const { resumo } = plano;
  const temDados = existentes.medicoes + existentes.fotos + existentes.notas > 0;
  const avisos = pcm.abas.flatMap((a) => a.avisos.map((t) => `${a.nome}: ${t}`));
  const orfaos = [
    resumo.orfaosItens > 0 && plural(resumo.orfaosItens, 'item', 'itens'),
    resumo.orfaosEquipamentos > 0 &&
      plural(resumo.orfaosEquipamentos, 'equipamento', 'equipamentos'),
  ].filter(Boolean);

  return (
    <section class="cartao">
      {atual && (
        <p class="previa-troca">
          Trocar <strong>{atual.nomeArquivo}</strong> ({dataCurta(atual.importadaEm)}) por:
        </p>
      )}
      <h2 class="previa-titulo">{arquivo.name}</h2>
      <table class="tabela">
        <thead>
          <tr>
            <th>Aba</th>
            <th>Equip.</th>
            <th>Itens</th>
          </tr>
        </thead>
        <tbody>
          {pcm.abas.map((a) => (
            <tr key={a.nome}>
              <td>{a.nome}</td>
              <td>{a.equipamentos.length}</td>
              <td>
                {a.equipamentos.reduce(
                  (s, e) => s + e.itens.filter((i) => i.origem === 'pcm').length,
                  0,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {avisos.length > 0 && (
        <div class="aviso aviso--bloco">
          <strong>
            <IconeAviso />
            Atenção na leitura:
          </strong>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {temDados && (
        <div class="aviso aviso--bloco">
          <p>
            Este aparelho tem {plural(existentes.medicoes, 'item medido', 'itens medidos')},{' '}
            {plural(existentes.fotos, 'foto', 'fotos')} e{' '}
            {plural(existentes.notas, 'observação de equipamento', 'observações de equipamento')}.{' '}
            <strong>Nada será apagado.</strong>
          </p>
          {resumo.remapeados > 0 && (
            <p>
              {plural(resumo.remapeados, 'registro mudou', 'registros mudaram')} de linha no PCM
              novo; as medidas vão junto.
            </p>
          )}
          {orfaos.length > 0 && (
            <p>
              {orfaos.join(' e ')} com medidas não estão no PCM novo: ficam como “Fora do PCM
              atual”.
            </p>
          )}
        </div>
      )}

      <div class="acoes acoes--pilha">
        <button type="button" class="botao botao--grande" onClick={() => onConfirmar(estado)}>
          {atual ? 'Trocar o PCM' : 'Importar'} (
          {plural(resumo.equipamentos, 'equipamento', 'equipamentos')})
        </button>
        <a class="botao botao--secundario" href={rotas.lista}>
          Cancelar
        </a>
      </div>
    </section>
  );
}
