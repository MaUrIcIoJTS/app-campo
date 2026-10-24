import { useState } from 'preact/hooks';
import type { Pcm } from '../dominio/tipos.ts';
import { gravarImportacao, previaImportacao, type PreviaImportacao } from '../db/repositorio.ts';
import { filaDeGravacao } from '../db/salvamento.ts';
import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { Topo } from './Topo.tsx';

type Etapa =
  | { etapa: 'escolher' }
  | { etapa: 'lendo'; nome: string }
  | { etapa: 'previa'; arquivo: File; pcm: Pcm; previa: PreviaImportacao; id: string }
  | { etapa: 'gravando' }
  | { etapa: 'erro'; mensagem: string };

const ACEITA =
  '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function TelaImportar({ onImportado }: { onImportado: (mensagem: string) => void }) {
  const { recarregar } = useDados();
  const [estado, setEstado] = useState<Etapa>({ etapa: 'escolher' });

  async function escolheu(input: HTMLInputElement) {
    const arquivo = input.files?.[0];
    input.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setEstado({ etapa: 'lendo', nome: arquivo.name });
    try {
      await filaDeGravacao.descarregar(); // medições pendentes entram no plano
      // SheetJS é pesado: só carrega aqui (e já está no cache offline).
      const { lerPcm } = await import('../dominio/pcm/parser.ts');
      const pcm = lerPcm(await arquivo.arrayBuffer());
      const equipamentos = pcm.abas.reduce((s, a) => s + a.equipamentos.length, 0);
      if (equipamentos === 0) {
        setEstado({
          etapa: 'erro',
          mensagem: 'Não achei equipamentos nesta planilha. Confira se é o arquivo do PCM.',
        });
        return;
      }
      const id = `imp-${Date.now()}`;
      setEstado({ etapa: 'previa', arquivo, pcm, previa: await previaImportacao(pcm, id), id });
    } catch (e) {
      console.error(e);
      setEstado({
        etapa: 'erro',
        mensagem:
          'Não consegui ler este arquivo. Ele abre no Excel? Tente salvar de novo como .xlsx.',
      });
    }
  }

  async function confirmar(e: Extract<Etapa, { etapa: 'previa' }>) {
    setEstado({ etapa: 'gravando' });
    try {
      await gravarImportacao(
        {
          id: e.id,
          nomeArquivo: e.arquivo.name,
          importadaEm: new Date().toISOString(),
          tamanho: e.arquivo.size,
          abas: e.pcm.abas.map((a) => a.nome),
          arquivo: e.arquivo,
        },
        e.previa.plano,
      );
      await recarregar();
      onImportado(`PCM importado: ${e.previa.plano.resumo.equipamentos} equipamentos.`);
    } catch (erro) {
      console.error(erro);
      setEstado({
        etapa: 'erro',
        mensagem: 'Não consegui gravar no aparelho. Nada foi alterado. Verifique o espaço livre.',
      });
    }
  }

  return (
    <>
      <Topo voltar={{ href: rotas.lista, rotulo: 'Lista' }} />
      <main class="tela">
        <h1 class="titulo-tela">Importar PCM</h1>
        {estado.etapa === 'escolher' && (
          <section class="cartao">
            <p>Escolha a planilha do PCM (.xls ou .xlsx). Os dados ficam só neste aparelho.</p>
            <BotaoArquivo onEscolher={escolheu} />
          </section>
        )}

        {estado.etapa === 'lendo' && (
          <p class="cartao" role="status">
            Lendo “{estado.nome}”…
          </p>
        )}

        {estado.etapa === 'previa' && <Previa estado={estado} onConfirmar={confirmar} />}

        {estado.etapa === 'gravando' && (
          <p class="cartao" role="status">
            Gravando no aparelho…
          </p>
        )}

        {estado.etapa === 'erro' && (
          <section class="cartao">
            <p class="erro" role="alert">
              {estado.mensagem}
            </p>
            <BotaoArquivo onEscolher={escolheu} rotulo="Escolher outro arquivo" />
          </section>
        )}
      </main>
    </>
  );
}

/** A câmera/arquivos SEMPRE por <label> + <input>: nunca .click() programático. */
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

function Previa({
  estado,
  onConfirmar,
}: {
  estado: Extract<Etapa, { etapa: 'previa' }>;
  onConfirmar: (e: Extract<Etapa, { etapa: 'previa' }>) => void;
}) {
  const { pcm, previa, arquivo } = estado;
  const { existentes, plano } = previa;
  const temDados = existentes.medicoes + existentes.fotos + existentes.notas > 0;
  const avisos = pcm.abas.flatMap((a) => a.avisos.map((t) => `${a.nome}: ${t}`));

  return (
    <section class="cartao">
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
          <strong>Atenção na leitura:</strong>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {temDados && (
        <p class="aviso aviso--bloco">
          Este aparelho já tem {existentes.medicoes} itens medidos e {existentes.fotos} fotos. Tudo
          será mantido.
          {plano.resumo.orfaos > 0 &&
            ` ${plano.resumo.orfaos} com dados não existem no PCM novo e ficam marcados “Fora do PCM atual”.`}
        </p>
      )}

      <div class="acoes acoes--pilha">
        <button type="button" class="botao botao--grande" onClick={() => onConfirmar(estado)}>
          Importar {plano.resumo.equipamentos} equipamentos
        </button>
        <a class="botao botao--secundario" href={rotas.lista}>
          Cancelar
        </a>
      </div>
    </section>
  );
}
