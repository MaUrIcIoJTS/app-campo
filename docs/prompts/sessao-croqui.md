# Sessão dedicada: croqui com as medidas externas dos equipamentos do PCM

## PASSO 0 — resultados de campo primeiro

Se eu trouxer resultados de campo, trate-os ANTES de tudo. Bug de campo vira teste antes da
correção, e dado sumido é prioridade máxima. Me mostre o diagnóstico e o plano da correção antes
de codar.

Leia `CLAUDE.md` e `docs/plano.md` antes de começar. A versão em campo é a da `main` publicada
no Pages, validada nos critérios 1 a 5. Ela não pode correr risco: trabalhe num branch
(`croqui`) e não faça push sem eu pedir.

## Objetivo

Quero informar as **medidas externas** (dimensões gerais do corpo) dos equipamentos do PCM que
têm corpo para medir: peneiras, aeroseparadores, silos, filtros etc. A medida vai num
**croqui**: o desenho do formato do equipamento com as cotas marcadas por letra (A, B, C…). Eu
olho o desenho, meço com a trena e digito cada cota. A ideia é a mesma do código do rolete
(A×B×C×D×E) e dos desenhos "onde medir" que já existem, mas para o corpo do equipamento.

Uso real: sol forte, luva, uma mão, tela de 360 px, Android/Chrome, sem sinal. Muitas vezes não
alcanço o topo, e equipamentos grandes eu meço pelo perímetro, com a trena em volta.

**Esta sessão começa com análise e protótipo visual. Não codifique no app antes da minha
aprovação.**

## O que já existe (para não redescobrir)

- **Desenhos SVG "onde medir"** em `src/ui/desenhos/`: cotas em âmbar, peça medida em amarelo
  claro (tokens `desenho*`). Ficam abertos no alto da guia, com "Ocultar", e também nos cartões.
- **Templates de campos por tipo de item** em `src/dominio/templates/registro.ts` (helpers
  `num`/`txt`/`opc`). A detecção do tipo fica em `src/dominio/templates/detectar.ts`. Leia a
  skill `novo-tipo-de-item`.
- **Itens deduzidos**: os tambores não estão no PCM, o app os cria a partir dele
  (`origem: 'deduzido'`, id `<equipamento>:tambor-<n>`). As medições são guardadas por `itemId`,
  então um item deduzido novo (o "exterior" do equipamento) não muda o esquema do IndexedDB.
  Confirme como a reimportação do PCM (`src/dominio/reimportacao.ts`) trata os itens
  deduzidos: o croqui não pode virar órfão nem perder medida quando eu reimportar.
- **Fotos** podem ter como alvo o equipamento ou um item.
- **Exportação**: item sem linha no PCM vai para a aba "Fora do PCM" da planilha. O backup
  `.json` leva tudo, e restaurar em outro aparelho já foi validado.
- **Ficha em guias**: PCM · Correia · Tambores · Roletes · Acionamento · Outros · Fotos · Notas
  (`src/dominio/guias.ts`).

## Equipamentos do PCM real (só contagens: 84 equipamentos em 6 abas)

Contagem pela 1ª palavra do nome. É o ponto de partida, e eu vou corrigir formatos e cotas:

| Categoria no PCM                     | Equip. | Formato proposto      | Cotas de partida                                        |
| ------------------------------------ | -----: | --------------------- | ------------------------------------------------------- |
| PENEIRA                              |      3 | caixa inclinada       | comprimento × largura × altura, inclinação, nº de decks |
| AEROSEPARADOR                        |      2 | cilindro + cone       | Ø do corpo, altura do cilindro, altura do cone, Ø saída |
| SILO                                 |      2 | cilindro + cone       | Ø do corpo, altura do corpo, altura do cone, saída      |
| FILTRO (de mangas)                   |      4 | caixa + tremonha      | L × C × altura da caixa, altura da tremonha, saída      |
| MOINHO, BRITADOR                     |  3 + 3 | caixa                 | L × C × A, boca de alimentação, saída                   |
| EXAUSTOR, RECIRCULADOR               |  5 + 2 | voluta                | largura × altura da carcaça, Ø entrada, saída L × A     |
| ROSCA                                |      4 | tubo ou calha         | Ø (ou L × A) × comprimento, entre mancais               |
| ELEVADOR (de canecas)                |      5 | coluna                | L × C da coluna, altura entre eixos, bocas              |
| VALVULA (rotativa)                   |      6 | corpo com flange      | flange L × C ou Ø, altura                               |
| TRANSPORTADORA, CORREIA, SALA, ZONA… |      — | sem croqui (proposta) | a transportadora já tem as medidas dela                 |

- Ciclone e tremonha **não são equipamentos no PCM**. A palavra CICLONE só aparece no nome de
  2 válvulas e 2 roscas, e TREMONHA não aparece. A tremonha surge como parte do corpo de outro
  equipamento (filtro, silo).
- 5 equipamentos têm nome curto ou sem categoria clara. A regra de detecção precisa ser
  calibrada contra o PCM real (`npm run pcm:resumo`, só local) e testada com nomes fictícios.

## O que analisar (me traga as respostas com uma recomendação)

1. **Quais categorias ganham croqui e com que formato.** Confirme ou corrija a tabela acima e,
   para cada formato, monte a tabela: letra, nome, como medir em campo e unidade. Diga quais
   cotas dá para medir por fora com trena e quais não dá. Agrupe categorias que dividem o mesmo
   formato (cilindro + cone, caixa…) para ter poucos desenhos.
2. **Detecção.** Pela categoria do nome do equipamento, sem pegar falso positivo (a "válvula do
   ciclone" é válvula). E o equipamento que fica sem croqui e precisa de um? Avalie um coringa
   (caixa ou cilindro) escolhido na hora. Pode ficar para depois.
3. **Medida que não alcanço.** Como marcar "sem acesso" ou "estimado"? Compare com o "Não tem"
   que já existe.
4. **Perímetro → Ø.** Eu digito o perímetro medido com a trena e o app calcula o Ø. Como mostrar
   isso sem confundir e como sair na planilha.
5. **Interação em 360 px, de luva.** Tocar a letra no desenho leva ao campo? Ou desenho fixo no
   alto e a lista de campos com a letra, como no rolete? O valor digitado aparece no desenho?
   Alvo de toque ≥ 48 px vale também dentro do SVG.
6. **Alternativas ao desenho padrão.** Avalie e diga por que sim ou não:
   - croqui à mão livre (desenhar com o dedo);
   - foto do equipamento com as letras marcadas por cima.
7. **Onde fica na ficha.** Guia nova ("Exterior" ou "Croqui")? Em que ordem? Como conta no
   progresso?
8. **Dados.** Item deduzido `<equipamento>:exterior`, como os tambores, ou outra forma? Precisa
   mudar o esquema do IndexedDB? Se precisar: nova versão, migração e teste da migração com
   dados da versão de hoje. Reimportar o PCM, fazer backup e restaurar precisam manter o croqui.
9. **Exportação.** Onde as cotas saem na planilha: "Fora do PCM" ou uma aba nova "Croquis", com
   uma coluna por cota? O desenho com as medidas pode ir como imagem no `.zip` de fotos? Diga o
   custo de cada opção.

## Entrega desta etapa (antes de codar)

- A tabela de categorias, formatos e cotas.
- **Esboço visual** de 2 formatos (sugiro peneira e aeroseparador) em 360 px, nos temas claro e
  escuro, mandado como imagem. Quero aprovar o traço, as letras e o tamanho.
- As decisões que dependem de mim, cada uma com a sua recomendação.
- Um plano curto de implementação em etapas. Primeiro um formato de ponta a ponta, depois os
  outros.
- Os testes previstos:
  - unitários do domínio (detecção, cotas, perímetro → Ø, ids);
  - E2E em 360 px: preencher o croqui, fechar e reabrir offline, e as cotas continuam lá;
  - reimportar o PCM sem perder croqui;
  - backup e restauração com croqui;
  - exportação.

Pare e espere minha aprovação.

## Critérios de aceite (da implementação, depois)

1. Informar as cotas de um aeroseparador em menos de 2 min, de luva e com uma mão.
2. Fechar o app no meio e reabrir offline: todas as cotas estão lá.
3. Reimportar o PCM não apaga nem torna órfão nenhum croqui.
4. As cotas saem na planilha e no backup, e restaurar em outro aparelho traz tudo.
5. Telas novas testadas em 360 px (E2E) e revisadas pelo subagente `revisor-de-campo`.

## Regras (do `CLAUDE.md`, valem aqui)

- **Nunca perder dado.** Gravação automática, backup e restauração não podem piorar.
- **Nada de rede em runtime.** Os desenhos são SVG próprios, dentro do build.
- **Nenhum dado real do cliente** em código, testes, docs ou commits. Use exemplos fictícios
  (`XA-AS-01`).
- Chunk principal abaixo de 60 kB gzip. Se os croquis pesarem, use `import()` sob demanda.
- Textos curtos, em português.

## Forma de trabalhar

Antes de codar, mostre um plano curto e espere a minha aprovação. Ao fim de cada etapa, rode o
checklist da skill `publicar` (sem push), atualize o `docs/plano.md` e me mostre o resultado em
360 px.
