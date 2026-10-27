# Croqui: medidas externas dos equipamentos

Pedido em 26/10. Ponto de partida: `docs/prompts/sessao-croqui.md`. O esboço visual da etapa 1
está em `prototipo/croqui/`: rode `npm run dev` e acesse `/prototipo/croqui/?forma=aero` (ou
`peneira`, com `&tema=escuro`).

## Situação

- **Etapa 1 (análise e esboço):** aprovada pelo usuário em 26/10, com todas as recomendações
  abaixo.
- **Etapa 2 (cilindro + cone no app):** feita em 26/10 no branch `croqui`, **sem publicar**.
  - Aeroseparador e silo ganham o item "MEDIDAS EXTERNAS" (tipos `corpo-aeroseparador` e
    `corpo-silo`) na guia "Exterior".
  - O croqui tem letras tocáveis. Os campos têm "Sem acesso", "Não tem", "≈ Estimado" e
    perímetro → Ø.
  - Na planilha, sai na aba "Fora do PCM".
  - Código: `src/dominio/croqui.ts`, `src/ui/CampoCroqui.tsx`, `src/ui/CroquiDaGuia.tsx`,
    `src/ui/desenhos/croqui.tsx`.
  - Com o PCM real (só contagens): 4 croquis (2 aeroseparadores, 2 silos); 0 de 3.073 células
    alteradas; a planilha reimporta igual.
  - Chunk principal: 52,6 kB gzip (antes 49,9). Na etapa 3, os 7 desenhos novos vão num chunk
    sob demanda.
- **Aeroseparador, a conferir em campo.** O desenho segue o separador mecânico usado em cal
  hidratada (tipo Raymond): corpo cilíndrico, acionamento e alimentação em cima, finos embaixo do
  cone e retorno de grossos de lado. O PCM real combina com isso (motor, polia, correia em V e
  duas "rodas" por aero). Se no campo as saídas forem outras, ajustamos D, E e F.
- **No celular que já tem o PCM:** depois de publicar, é preciso "Trocar o PCM" com o mesmo
  arquivo para os croquis aparecerem. A prévia diz "Nada será apagado".

## Como fica (protótipo)

- **Guia "Exterior"** logo depois de "PCM". Nela fica um cartão "MEDIDAS EXTERNAS", que não
  está no PCM, como os tambores.
- **Desenho no alto**, aberto, com "Ocultar", como nas outras guias. Cada cota tem uma letra
  num círculo, e o círculo diz o estado:
  - vazio: falta medir;
  - cheio: medida;
  - cinza: sem acesso.

  Tocar na letra leva ao campo. A área de toque tem cerca de 48 px em 360 px.

- **Campos** com a mesma letra ao lado do nome. Cada campo tem "Sem acesso" no lugar do
  "Não tem". O chip "≈ Estimado" só aparece depois de digitar o valor. No Ø do corpo há o chip
  "Medi o perímetro".
- O valor não é escrito no desenho: em 360 px, polui. O círculo cheio ou vazio já mostra o que
  falta.

## Formatos e cotas

Os 39 equipamentos que recebem croqui saem das categorias do PCM real (1ª palavra do nome).
Transportadora, correia, sala, zona, skip, gaveta, gasogênio e os outros ficam sem croqui.

| Formato          | Categorias (equip.)            | Cotas                                                                                                                                |
| ---------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cilindro + cone  | AEROSEPARADOR (2), SILO (2)    | A Ø do corpo · B altura do cilindro · C altura do cone · D Ø da saída de baixo · E Ø do duto de cima · F entrada (L × A)             |
| Caixa inclinada  | PENEIRA (3)                    | A comprimento da caixa · B largura · C altura · D inclinação (°) · E nº de decks (1–4)                                               |
| Caixa + tremonha | FILTRO de mangas (4)           | A comprimento da caixa · B largura · C altura da parte reta · D altura da tremonha · E saída da tremonha (L × C ou Ø)                |
| Caixa            | MOINHO (3), BRITADOR (3)       | A comprimento · B largura · C altura · D boca de alimentação (L × C) · E saída (L × C)                                               |
| Voluta           | EXAUSTOR (5), RECIRCULADOR (2) | A largura da carcaça (no sentido do eixo) · B altura · C comprimento · D Ø da boca de entrada · E boca de saída (L × A)              |
| Tubo ou calha    | ROSCA (4)                      | A comprimento entre cabeceiras · B tubo ou calha · C Ø do tubo ou largura da calha · D altura da calha · E entre centros dos mancais |
| Coluna           | ELEVADOR de canecas (5)        | A largura da coluna · B profundidade · C altura entre eixos · D boca de alimentação (L × A) · E boca de descarga (L × A)             |
| Corpo com flange | VALVULA rotativa (6)           | A flange de entrada (L × C ou Ø) · B altura entre flanges · C largura do corpo · D comprimento do corpo                              |

- **Unidades:** tudo em mm, menos a inclinação (°) e o nº de decks. "L × A" e "L × C" são
  texto ("600 × 300").
- **O que a trena não alcança:**
  - o duto e as bocas de cima (cilindro + cone, elevador);
  - a altura entre eixos do elevador;
  - a altura do silo.

  Esses campos têm "Sem acesso" ou "≈ Estimado".

- **Ø grande:** é mais fácil passar a trena em volta. Nesse caso, digita-se o perímetro (A, no
  cilindro + cone; C, no tubo).
- **"Válvula do ciclone" e "rosca do ciclone"** são válvulas e roscas: a detecção usa só a 1ª
  palavra do nome.

## Decisões (com recomendação)

1. **Interação: desenho no alto, letra tocável e lista de campos com a mesma letra.**
   Recomendo como está no protótipo.
2. **Como gravar "Sem acesso" e "≈ Estimado": dentro do próprio texto digitado.**
   - "Sem acesso" grava `sem acesso` no valor; "≈ Estimado" põe `≈ ` na frente do número. O app
     lê o número ignorando o `≈`.
   - Por quê: o backup de hoje recusa marca que não conhece (`MARCAS` em `lerBackup.ts`). Uma
     marca nova faria um celular com a versão de hoje recusar um backup novo. Com texto, nada
     muda no esquema nem no backup.
   - Na planilha sai legível: `C — Altura do cone: ≈ 1800 mm`.
3. **Perímetro → Ø.**
   - O perímetro é um campo próprio, guardado como foi digitado, como toda medida.
   - O Ø é calculado e mostrado, mas não é gravado.
   - Na planilha: `A — Ø do corpo: 1910 mm (perímetro 6000 mm ÷ π)`.
4. **Progresso:** o cartão conta como um item; "Sem acesso" conta como feito.
5. **Inclinação da peneira:** em graus, com um app de nível no celular (dica no campo). Usar o
   sensor do próprio celular no app fica para depois.
6. **Alternativas descartadas:**
   - **Croqui à mão livre:** com luva, ao sol e com uma mão não dá. Além disso, vira imagem sem
     número e não sai em colunas.
   - **Foto com letras marcadas por cima:** marcar pontos na foto com luva é impreciso e custa
     caro. A foto do equipamento continua no botão "Tirar foto" do cartão.
7. **Exportação:** começar pela aba "Fora do PCM", que já existe, com
   `A — Ø do corpo: …; B — …`.
   - Uma aba "Croquis", com uma coluna por letra, só vale se você quiser comparar equipamentos
     lado a lado. O custo é médio.
   - A imagem do croqui no `.zip` não vale: exige converter SVG em PNG no celular, mais código e
     peso.
8. **Coringa (caixa ou cilindro) para equipamento sem croqui:** fica para depois. Precisa de
   item criado em campo (`origem: 'manual'`) e de uma tela para escolher o formato.
9. **Celular que já tem o PCM importado.** O item exterior é deduzido na importação, como os
   tambores, então ele só aparece no celular depois de uma destas opções:
   - **(a) Reimportar o mesmo PCM ("Trocar o PCM").** O fluxo já foi validado e a prévia diz
     "Nada será apagado". Não precisa de migração. **Recomendo esta.**
   - **(b) Migração do IndexedDB que acrescenta os itens.** É automática, mas é código novo no
     ponto mais sensível. Exige uma nova versão do banco e o teste da migração.

## Dados

- O item é deduzido: `<equipamento>:exterior`, nome `MEDIDAS EXTERNAS`, `origem: 'deduzido'`,
  `linha: null`. Há um tipo por formato (`corpo-cilindro-cone`, `corpo-caixa-inclinada`…), e
  todos vão para a guia `exterior`.
- As medições continuam por `itemId`, então o esquema do IndexedDB não muda.
- Na reimportação, os itens são casados por equipamento + nome, como os tambores. Isso precisa
  de teste.
- Os desenhos vão num chunk carregado sob demanda (`import()`), dentro do precache, para não
  pesar no principal (hoje com 49,9 kB gzip; o limite é 60).

## Plano de implementação

1. **Etapa 2: cilindro + cone de ponta a ponta** (aeroseparador e silo):
   - detecção, template, dedução do item e guia "Exterior";
   - letras tocáveis, "Sem acesso", "≈" e perímetro;
   - saída em "Fora do PCM".
2. **Etapa 3: os outros 7 formatos** (desenhos e templates), na mesma estrutura.
3. **Etapa 4 (opcional):** o coringa manual e a aba "Croquis".

A cada etapa: o checklist da skill `publicar` (sem push), o `revisor-de-campo` nas telas e o
`docs/plano.md` atualizado.

## Testes previstos

- **Unitários:**
  - detecção pela categoria, inclusive "válvula do ciclone" → válvula, e a categoria sem croqui;
  - perímetro → Ø;
  - `≈` e `sem acesso` no valor (número lido, sem aviso de "não é número");
  - id estável do item;
  - texto na planilha.
- **Reimportação:** o item exterior continua com as medidas e não vira órfão.
- **Backup e restauração** com croqui.
- **E2E em 360 px:**
  - tocar na letra leva ao campo;
  - preencher, fechar à força e reabrir offline, e as cotas continuam lá;
  - exportar.
