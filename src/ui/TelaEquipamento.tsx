import { useEffect } from 'preact/hooks';
import { TEMPLATES } from '../dominio/templates/registro.ts';
import { useDados } from './dados.tsx';
import { rotas } from './rota.ts';
import { Topo } from './Topo.tsx';

/** Ficha do equipamento. Fase 1: só os itens do PCM (medição entra na fase 2). */
export function TelaEquipamento({ id }: { id: string }) {
  const { dados, erro } = useDados();
  useEffect(() => window.scrollTo(0, 0), [id]);

  const voltar = { href: rotas.lista, rotulo: 'Lista' };
  const eq = dados?.equipamentos.find((e) => e.id === id);
  if (!dados || !eq) {
    return (
      <>
        <Topo voltar={voltar} />
        <main class="tela">
          {erro ? (
            <p class="erro" role="alert">
              ⚠ {erro}
            </p>
          ) : (
            <p class="suave">{dados ? 'Equipamento não encontrado.' : 'Abrindo…'}</p>
          )}
        </main>
      </>
    );
  }

  const itens = dados.itensPorEquipamento.get(id) ?? [];
  return (
    <>
      <Topo voltar={voltar} />
      <main class="tela">
        <section class="cabecalho-eq">
          <p class="eq-aba">{eq.aba}</p>
          <h1 class="titulo-tela">{eq.tag ?? eq.nome}</h1>
          {eq.tag && <p class="cabecalho-nome">{eq.nome}</p>}
          <p class="suave">{itens.length === 1 ? '1 item' : `${itens.length} itens`}</p>
          {eq.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
        </section>

        <ol class="itens">
          {itens.map((i) => (
            <li key={i.id} class="item cartao">
              <h2 class="item-nome">{i.nome}</h2>
              <p class="item-tipo">{TEMPLATES[i.tipo].nome}</p>
              {i.especificacao && (
                <p class="item-pcm">
                  <span class="rotulo-pcm">PCM</span> {i.especificacao}
                </p>
              )}
              {i.quantidade && <p class="item-qtd">Qtd.: {i.quantidade}</p>}
              {i.origem === 'deduzido' && (
                <span class="selo">Não está no PCM — deduzido dos mancais</span>
              )}
              {i.orfao && <span class="selo selo--alerta">Fora do PCM atual</span>}
            </li>
          ))}
        </ol>
        <p class="suave nota-fase">Campos de medição: próxima versão do app.</p>
      </main>
    </>
  );
}
