---
name: Levantamento PCM
description: Medir equipamentos em campo, de luva e ao sol, e conferir contra o PCM, 100% offline.
colors:
  primaria: '#0842a0'
  primaria-texto: '#ffffff'
  primaria-container: '#d3e3fd'
  primaria-container-texto: '#041e49'
  tonal: '#c2e7ff'
  tonal-texto: '#001d35'
  fundo: '#f0f4f9'
  superficie: '#ffffff'
  superficie-alta: '#e9eef6'
  campo: '#e7ecf2'
  texto: '#1f1f1f'
  texto-suave: '#444746'
  contorno: '#747775'
  divisor: '#c4c7c5'
  barra-fundo: '#c9d3e0'
  trilho: '#e9eef6'
  desenho: '#6e4b00'
  desenho-fundo: '#ffefc4'
  desenho-texto: '#ffffff'
  erro: '#8c1d18'
  erro-texto: '#ffffff'
  erro-container: '#f9dedc'
  erro-container-texto: '#410e0b'
  ok: '#0f5223'
  ok-texto: '#ffffff'
  ok-container: '#c4eed0'
  ok-container-texto: '#072711'
  aviso: '#8a5300'
  aviso-fundo: '#ffe08a'
  aviso-texto: '#3a2700'
  inversa: '#303030'
  inversa-texto: '#f2f2f2'
  inversa-primaria: '#a8c7fa'
  foco: '#0842a0'
  foto-fundo: '#000000'
typography:
  headline:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.6rem'
    fontWeight: 400
    lineHeight: 1.25
  title-bar:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.25rem'
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.15rem'
    fontWeight: 500
    lineHeight: 1.3
  medida:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.2rem'
    fontWeight: 500
    fontFeature: 'tnum'
  body:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '18px'
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.9rem'
    fontWeight: 400
  label:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.875rem'
    fontWeight: 500
  ficha-tag:
    fontFamily: "'Roboto Condensed', sans-serif-condensed, 'Arial Narrow', Roboto, sans-serif"
    fontSize: '2rem'
    fontWeight: 700
    lineHeight: 1.1
  ficha-guia:
    fontFamily: "'Roboto Condensed', sans-serif-condensed, 'Arial Narrow', Roboto, sans-serif"
    fontSize: '1.375rem'
    fontWeight: 700
    lineHeight: 1.15
  ficha-item:
    fontFamily: "'Roboto Condensed', sans-serif-condensed, 'Arial Narrow', Roboto, sans-serif"
    fontSize: '1.3rem'
    fontWeight: 700
    lineHeight: 1.3
  titulo-vazio:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.35rem'
    fontWeight: 400
  titulo-arquivo:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.1rem'
    fontWeight: 500
  body-large:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.05rem'
    fontWeight: 400
  subtitle:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1rem'
    fontWeight: 500
  body-medium:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.95rem'
    fontWeight: 400
  caption:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.85rem'
    fontWeight: 500
  desenho:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '15px'
    fontWeight: 400
  extensao:
    fontFamily: "Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '0.9em'
    fontWeight: 400
rounded:
  raio-etiqueta: '6px'
  raio-chip: '8px'
  raio-campo: '8px'
  raio-aviso: '12px'
  raio-cartao: '20px'
  pilula: '999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  espaco: '16px'
  lg: '24px'
  toque: '48px'
components:
  botao:
    backgroundColor: '{colors.primaria}'
    textColor: '{colors.primaria-texto}'
    typography: '{typography.label}'
    rounded: '{rounded.pilula}'
    padding: '0 24px'
    height: '48px'
  botao-grande:
    backgroundColor: '{colors.primaria}'
    textColor: '{colors.primaria-texto}'
    rounded: '{rounded.pilula}'
    padding: '0 16px'
    height: '56px'
    width: '100%'
  botao-secundario:
    backgroundColor: '{colors.tonal}'
    textColor: '{colors.tonal-texto}'
    rounded: '{rounded.pilula}'
    padding: '0 24px'
    height: '48px'
  botao-texto:
    textColor: '{colors.primaria}'
    rounded: '{rounded.pilula}'
    padding: '0 12px'
    height: '48px'
  botao-perigo:
    backgroundColor: '{colors.erro}'
    textColor: '{colors.erro-texto}'
    rounded: '{rounded.pilula}'
    padding: '0 24px'
    height: '48px'
  campo:
    backgroundColor: '{colors.campo}'
    textColor: '{colors.texto}'
    rounded: '{rounded.raio-campo}'
    padding: '0 16px'
    height: '56px'
  busca:
    backgroundColor: '{colors.superficie-alta}'
    textColor: '{colors.texto}'
    rounded: '{rounded.pilula}'
    padding: '0 56px 0 52px'
    height: '56px'
  cartao:
    backgroundColor: '{colors.superficie}'
    textColor: '{colors.texto}'
    rounded: '{rounded.raio-cartao}'
    padding: '16px'
  chip-escolha:
    textColor: '{colors.texto}'
    rounded: '{rounded.raio-chip}'
    padding: '0 16px'
    height: '48px'
  chip-escolha-marcado:
    backgroundColor: '{colors.primaria}'
    textColor: '{colors.primaria-texto}'
    rounded: '{rounded.raio-chip}'
  conferir-botao:
    textColor: '{colors.ok}'
    rounded: '{rounded.pilula}'
    size: '52px'
  conferir-botao-confere:
    backgroundColor: '{colors.ok}'
    textColor: '{colors.ok-texto}'
    size: '52px'
  conferir-botao-diverge:
    backgroundColor: '{colors.erro}'
    textColor: '{colors.erro-texto}'
    size: '52px'
  salvo-salvo:
    backgroundColor: '{colors.ok-container}'
    textColor: '{colors.ok-container-texto}'
    typography: '{typography.label}'
    rounded: '{rounded.raio-chip}'
    padding: '0 12px 0 8px'
    height: '36px'
  item-estado-diverge:
    backgroundColor: '{colors.erro}'
    textColor: '{colors.erro-texto}'
    typography: '{typography.label}'
    rounded: '{rounded.raio-chip}'
    padding: '2px 10px'
    height: '28px'
  aviso:
    backgroundColor: '{colors.aviso-fundo}'
    textColor: '{colors.aviso-texto}'
    rounded: '{rounded.raio-aviso}'
    padding: '12px 16px'
  snackbar:
    backgroundColor: '{colors.inversa}'
    textColor: '{colors.inversa-texto}'
    rounded: '{rounded.raio-chip}'
    padding: '14px 16px'
---

# Design System: Levantamento PCM

## Overview

**Creative North Star: "A ferramenta que some atrás da tarefa"**

O sistema é o Material 3 do Android, medido pela régua de acabamento dos apps do próprio Google (Arquivos, Keep, Configurações), e depois apertado para o campo: sol forte, luva, uma mão, tela de 360 px. O técnico tem de achar no primeiro olhar onde está, o que falta e qual é a próxima ação, e confiar que tudo está salvo. A familiaridade é escolha (o usuário preferiu o padrão da categoria a um mundo próprio); o que diferencia o app é ser legível ao sol e tocável de luva, não ter um estilo novo.

A profundidade vem de superfícies tonais: fundo azul-acinzentado claro, cartões brancos de raio 20, controles em pílula. Peso 400/500, nunca negrito. Cor forte só onde há ação, seleção ou estado: azul para agir e para o que está marcado, verde para confere e salvo, vermelho para diverge e erro, âmbar para aviso. Quando um requisito de campo bate de frente com a especificação do Material, vence o campo: os tokens claros de ação e estado estão no tom 30 do M3 (não no tom 40), os botões tonais levam anel de 1 px no tema claro, a linha inferior dos campos é mais escura e mais grossa, os chips marcados são preenchidos.

Rejeições confirmadas na tese de direção: molduras escuras de 2 px em volta de tudo, caixa dentro de caixa, negrito em tudo.

**Key Characteristics:**

- Superfícies tonais no lugar de molduras; divisórias de 1 px só dentro de listas e tabelas.
- Pílula para ação, raio 8 para chip e campo, raio 20 para cartão.
- Roboto do sistema (nenhuma fonte entra no build), 400 e 500, raiz de 18 px.
- Ícones SVG próprios de traço 2 px, sempre acompanhados de texto ou rótulo acessível.
- Alvos de toque de 48 px no mínimo; 52 a 64 px nas ações de medição.
- Dois temas de alto contraste com os mesmos papéis; o escuro troca valores, não a estrutura.

## Colors

Um azul de ação sobre neutros azulados frios, com três cores de estado (verde, vermelho, âmbar) reservadas a significados fixos. Os valores do frontmatter são do tema claro; o tema escuro redefine os mesmos tokens (tabela abaixo) por `prefers-color-scheme: dark` ou por `data-tema='escuro'` no `<html>`.

### Primary

- **Azul Google profundo** (`primaria`): botão preenchido, chip marcado ("Não tem", opções), links, cursor do campo, linha do campo focado, barras de progresso, ícone inicial das seções. É o tom 30 do M3; o tom 40 (#0b57d0) previsto no contrato perdeu contraste ao sol e foi trocado.
- **Azul claro de container** (`primaria-container` / `primaria-container-texto`): círculo atrás do ícone nas linhas de lista, cartão de backup em destaque, seleção de texto.

### Secondary

- **Azul-céu tonal** (`tonal` / `tonal-texto`): botão tonal (ação comum: foto, galeria, próximo item, preparar).

### Desenhos "onde medir"

- **Âmbar de prancheta** (`desenho`, `desenho-fundo`, `desenho-texto`): só dentro dos desenhos, como no protótipo de campo que o técnico aprovou. Cotas e setas em âmbar escuro (aparece ao sol); a peça que se mede (tambor, tubo do rolete, polias) em amarelo claro com contorno âmbar; marcas numeradas em âmbar. O texto do desenho fica na cor do texto: 400 no nome da peça, 600 no que se mede.

### Tertiary

- **Verde confere** (`ok`, `ok-container`): ✓ marcado, Δ igual a zero, item "feito", chip "Salvo no aparelho", aviso de arquivo baixado, ícone de estado bom no rodapé.
- **Vermelho diverge** (`erro`, `erro-container`): ✗ marcado, borda do cartão que diverge, selo "Diverge", campo inválido, ações perigosas, chip "Não salvou".
- **Âmbar aviso** (`aviso`, `aviso-fundo`, `aviso-texto`): avisos em bloco, linha de backup em alerta, selo de pendência nos equipamentos.

### Neutral

- **Névoa azulada** (`fundo`): fundo da página e da barra superior em repouso.
- **Papel branco** (`superficie`): cartões, listas, linhas de ação, topo grudado do cartão do item.
- **Névoa alta** (`superficie-alta`): barra superior e barra de guias depois de rolar, barra de busca, select, selos neutros, Δ diferente de zero, miniatura carregando, o valor do PCM ("PCM: [valor]") e a faixa de bloco dentro do cartão ("Mancal e rolamento").
- **Tinta como seleção** (`texto` de fundo, `fundo` de texto): a guia aberta da ficha, como no protótipo; ao sol é o par de maior contraste.
- **Campo** (`campo`): fundo dos campos preenchidos.
- **Tinta** (`texto`) e **Grafite** (`texto-suave`): texto principal e secundário. O secundário mira 7:1 e também desenha a linha dos campos em repouso.
- **Contorno** (`contorno`): anel dos botões tonais no claro, dos ✓/✗ e dos chips desmarcados, separador entre campos de medição.
- **Divisor** (`divisor`): linhas entre itens de lista, de tabela e entre cópias de backup; borda do chip "Salvo" neutro.
- **Trilho de barra** (`barra-fundo`): fundo das barras de progresso, escurecido para aparecer ao sol.
- **Inversa** (`inversa`, `inversa-texto`, `inversa-primaria`): snackbars (aviso temporário e nova versão).
- **Preto de foto** (`foto-fundo`): fundo da foto ampliada, com um véu preto a 85 % atrás (como a galeria do Android); só ali.

### Tema escuro

| Token           | Escuro  | Token                             | Escuro                      |
| --------------- | ------- | --------------------------------- | --------------------------- |
| fundo           | #131314 | primaria                          | #a8c7fa                     |
| superficie      | #1e1f20 | primaria-texto                    | #062e6f                     |
| superficie-alta | #282a2c | primaria-container                | #0842a0                     |
| campo           | #333537 | primaria-container-texto          | #d3e3fd                     |
| texto           | #e3e3e3 | tonal / tonal-texto               | #004a77 / #c2e7ff           |
| texto-suave     | #c4c7c5 | erro / erro-texto                 | #f2b8b5 / #601410           |
| contorno        | #8e918f | erro-container / -texto           | #8c1d18 / #f9dedc           |
| divisor         | #444746 | ok / ok-texto                     | #6dd58c / #0a3818           |
| barra-fundo     | #4a4d50 | ok-container / -texto             | #0f5223 / #c4eed0           |
| trilho          | #282a2c | aviso / aviso-fundo / aviso-texto | #fcc934 / #4d3a00 / #ffe08a |
| desenho         | #f2b705 | desenho-fundo / desenho-texto     | #3a3115 / #131314           |
| foco            | #a8c7fa | inversa / -texto / -primaria      | #e3e3e3 / #303030 / #0842a0 |

No escuro, `--anel-tonal` é `none`: o tonal escuro já se separa do fundo.

### Named Rules

**The Cor É Estado Rule.** Verde, vermelho e âmbar significam confere/salvo, diverge/erro e aviso, e nada mais. Nunca usar uma delas como decoração ou para dar destaque a algo que não é estado. A única exceção é o âmbar de prancheta dentro dos desenhos "onde medir" (tokens `desenho*`, nunca `aviso*`).

**The Nunca Só Cor Rule.** Todo estado vermelho ou âmbar vem com ícone (✗, ⚠) e palavra ("Diverge", "Não salvou"). A cor reforça; não carrega o significado sozinha.

**The Tom 30 Rule.** No tema claro, ação e estado usam o tom 30 do M3 (`primaria`, `erro`, `ok`), não o tom 40 padrão. Ao sol, contraste vem antes da fidelidade à especificação.

## Typography

**Title Font:** Roboto Condensed do sistema (`'Roboto Condensed', sans-serif-condensed`, que o Android já traz; nada é baixado), só nos títulos da ficha.
**Body Font:** Roboto do sistema (com system-ui, -apple-system, 'Segoe UI', sans-serif)

**Character:** A família do próprio Android, em 400 e 500 no texto. Os títulos da ficha (TAG, título da guia, nome do item) são condensados e em 700, como no protótipo de campo; todo o resto tira a hierarquia de tamanho e de cor, não de negrito. `strong` e `b` são 500.

A raiz é 18 px, então `1rem` = 18 px. Todo input, select, textarea e botão tem no mínimo 16 px.

### Hierarchy

- **Headline** (400, 1.6rem, 1.25): título das telas (lista, backup, restaurar); quebra em qualquer ponto (`overflow-wrap: anywhere`).
- **Ficha** (condensada, 700): TAG do equipamento (2rem), título da guia (1.375rem) e nome do item no cartão (1.3rem, até 2 linhas).
- **Title-bar** (400, 1.25rem, 1.2): nome curto do app na barra superior da tela inicial; uma linha com reticências.
- **Title** (500, 1rem a 1.15rem): título de seção nos cartões, do desenho da guia e da faixa "Mancal e rolamento".
- **Medida** (500, 1.2rem, algarismos tabulares): o valor digitado no campo de medição.
- **Body** (400, 18 px, 1.45): texto corrido; os campos comuns usam 1.05rem.
- **Body-small** (400, 0.9rem): texto de apoio (contagens, notas, legendas dos desenhos, datas).
- **Label** (500, 0.875rem): chips, selos, botões, cabeçalhos de tabela, títulos de grupo de fotos. Sem caixa alta.
- **Degraus de apoio** (já em uso): body-large 1.05rem (campos comuns, TAG na lista, nome do equipamento), subtitle 1rem/500 (subtítulos de guia, faixa de bloco, Δ), body-medium 0.95rem (subtítulo de tela, snackbars, tabelas, "Ocultar"), caption 0.85rem/500 (selos, contagem na guia, nome de arquivo), 1.35rem (título da lista vazia), 1.1rem (título do arquivo pronto), 15 px no desenho (escala ~1 em 360 px) e 0.9em na extensão do arquivo.

### Named Rules

**The Negrito Só no Título Rule.** Só os títulos condensados da ficha passam de 500. Rótulo, valor, botão e ênfase ficam em 500, nunca 700.

**The Algarismo Tabular Rule.** Todo número que se compara (PCM, medido, Δ, %, "3/7", colunas de tabela) usa `font-variant-numeric: tabular-nums`.

## Layout

Coluna única centrada, `max-width: 720px`, com margens laterais de 16 px (`--espaco`) e 96 px de folga no fim para nada ficar sob a barra de atualização. A tela de referência é 360 × 740; no desktop a mesma coluna fica centrada, sem layout próprio.

Ritmo de 4 px: 4, 8, 12, 16 e 24 px. 8 px entre botões e chips, 12 px entre cartões e entre itens, 16 px de padding de cartão (14 px no cartão do item), 24 px antes de um grupo novo.

A barra superior é fixa e tem 64 px (mais a área segura): voltar à esquerda, chip "Salvo no aparelho" à direita, sempre à vista. Na ficha, a barra de guias (64 px, chips em pílula de 48 px) prende logo abaixo dela e rola de lado sozinha; o nome do item gruda abaixo das guias, e o `scroll-padding-top` evita que o campo focado fique escondido sob as três. Cada guia de medida abre com o seu título e o desenho "onde medir" aberto; "Ocultar" fica lembrado no aparelho.

Grupos de ações (`.acoes`) quebram linha com base de 140 px; em pilha ocupam a largura toda. Fotos em grade de 3 colunas (cerca de 90 px cada em 360 px). Ações finais e da foto ampliada ficam embaixo, no alcance do polegar.

### Named Rules

**The Nada Muda Sob o Dedo Rule.** Estados que mudam (diverge, salvando, marcado) não mexem no layout: a borda de 2 px do cartão do item existe sempre, transparente, e só ganha cor ao divergir.

**The Perigoso Longe Rule.** Ação destrutiva fica separada da comum por espaço (12 a 16 px) ou por outra linha; "Sim, apagar" e "Não, manter" nunca encostam.

## Elevation & Depth

O sistema é plano e tonal. Cartões, listas e barras não têm sombra; a profundidade vem do contraste entre `fundo`, `superficie` e `superficie-alta`. A barra superior muda de `fundo` para `superficie-alta` quando a página rola, em vez de ganhar sombra. Sombra existe só no que flutua sobre o conteúdo: as duas snackbars.

O toque pressionado é uma camada da cor do texto do controle a 14% (`--camada-toque`), aplicada como fundo ou `background-image` no `:active`.

### Shadow Vocabulary

- **Snackbar** (`box-shadow: 0 4px 8px 3px rgb(0 0 0 / 0.15), 0 1px 3px rgb(0 0 0 / 0.3)`): aviso temporário no topo e barra de nova versão embaixo.
- **Anel tonal** (`box-shadow: inset 0 0 0 1px var(--contorno)`): não é elevação, é contorno interno; botão tonal no claro, ✓/✗ e chips desmarcados.

### Named Rules

**The Plano Por Padrão Rule.** Nada que fica no fluxo da página leva sombra. Sombra é só para o que flutua por cima.

## Shapes

Três formas: pílula (999 px) para botões, busca e select; raio 8 para chips, selos, campos (só nos cantos de cima, com a linha embaixo) e snackbars; raio 20 para cartões, listas e linhas de ação. Avisos em bloco e miniaturas de foto usam 12. Círculo para os ✓/✗, o voltar e o fundo de ícone das linhas de lista.

Bordas de verdade só em três lugares: divisórias de 1 px dentro de listas e tabelas, o separador de 1 px em `contorno` entre campos de medição, e a borda de 2 px do cartão que diverge. A miniatura que está gravando usa borda tracejada de 2 px.

## Components

### Buttons

Pílulas do Material, firmes e grandes para a luva.

- **Shape:** pílula (999 px), altura mínima de 48 px; `botao--grande` tem 56 px e largura total; "Próximo equipamento" tem 64 px em duas linhas (ação e, embaixo, o nome do próximo).
- **Primary (preenchido):** `primaria` com `primaria-texto`, 500, padding 0 24 px, ícone a 1.2em com gap de 8 px. Uma ação principal por momento.
- **Tonal (`botao--secundario`):** `tonal` com `tonal-texto` e anel de 1 px em `contorno` no tema claro. Dentro do cartão de backup em destaque vira `superficie` com texto `primaria`.
- **Texto (`botao--texto`):** transparente, texto `primaria`, padding 0 12 px, mantém os 48 px de toque.
- **Perigo:** preenchido em `erro`, ou contorno de 1 px em `erro` sobre transparente para o perigo secundário.
- **Pressed / Focus / Disabled:** camada de toque de 14% no `:active`; foco com contorno de 3 px em `foco`, afastado 2 px; desabilitado com fundo do texto a 12% e texto a 50%, sem anel. Transição de fundo de 150 ms em `cubic-bezier(0.2, 0, 0, 1)`.

### Chips

- **Salvo no aparelho:** chip de estado de 36 px na barra superior. Verde (`ok-container`) quando salvo; neutro com borda `divisor` e ícone girando em `primaria` enquanto salva; vermelho (`erro-container`), com 48 px e tocável, quando não salvou.
- **Escolha ("Não tem" e opções):** chips de filtro de raio 8 com anel de 1 px em `contorno`, 500. "Não tem" tem 112 × 52 px; opções têm 48 px e dividem a linha. Marcados ficam preenchidos em `primaria` com visto.
- **Selos:** `item-estado` (28 px: "3/7" neutro, feito verde, aviso âmbar, "Diverge" preenchido em `erro`), `selo` neutro ou de alerta, e o Δ (neutro; verde quando zero).
- **Valor do PCM:** "PCM:" em texto suave e o valor numa etiqueta `superficie-alta` de raio 6, em 500 tabular (o que o técnico compara fica em destaque, como no protótipo).

### Cards / Containers

- **Corner Style:** 20 px.
- **Background:** `superficie` sobre `fundo`; o cartão de backup em destaque usa `primaria-container`.
- **Shadow Strategy:** nenhuma (ver Elevation & Depth).
- **Border:** nenhuma, exceto o cartão do item: 2 px sempre presente, transparente, `erro` ao divergir.
- **Internal Padding:** 16 px; cartão do item 14 px, com o topo (nome e selo) grudado sob a barra.

### Inputs / Fields

- **Style:** campo preenchido do Material: fundo `campo`, 56 px de altura, raio 8 só em cima, linha inferior de 2 px em `texto-suave` em repouso.
- **Focus:** a linha vira 3 px em `primaria`. Na busca e no select (pílulas em `superficie-alta`, sem linha), o foco é um anel interno de 2 px em `primaria`.
- **Error:** fundo `erro-container`, texto `erro-container-texto`, linha de 3 px em `erro`, e a mensagem com ícone embaixo.
- **Medição:** rótulo em 500 com a unidade em texto suave; o valor do PCM na linha de baixo, à esquerda (valor longo quebra sem ficar torto); o input em 1.2rem tabular ao lado dos ✓/✗; Δ e mensagens embaixo. Um campo pode abrir um bloco dentro do cartão (`grupo`): faixa `superficie-alta` de ponta a ponta com o título ("Mancal e rolamento").

### Navigation

- **Barra superior:** 64 px, fundo `fundo`, que vira `superficie-alta` ao rolar. Voltar com área de 64 × 56 px e ícone de 24 px, camada de toque circular. Na tela inicial, o nome curto do app no lugar do voltar.
- **Linhas de ação:** `linha-backup` (72 px: círculo de ícone tonal, duas linhas de texto, chevron; âmbar quando em alerta) e `link-acao` (56 px, texto `primaria`), ambas em cartão de raio 20.
- **Listas:** equipamentos numa superfície única de raio 20 com divisórias de 1 px, linhas de 72 px no mínimo (TAG em 500, aba à direita, nome em 2 linhas, barra de % de 6 px e contadores). Os desenhos dos cartões são `<details>` de 56 px com chevron que gira 180°.
- **Guias da ficha:** chips em pílula de 48 px com anel `contorno`; a aberta em tinta. Ao lado do nome, ✓ verde em círculo (tudo feito), ✗ vermelho em círculo (algo diverge) ou o número de fotos; leitor de tela ouve "Correia diverge", "Fotos 3". A guia PCM é uma lista com divisórias (item, especificação, qtd. e selo) que leva ao item; "Seguir para X" (botão grande com a contagem embaixo) fecha cada guia.
- **Desenho da guia:** cartão aberto no alto da guia, título em 500 e "Ocultar"/"Ver desenho" em azul na mesma linha de 56 px; figura e legenda embaixo.

### Conferir (✓ / ✗)

O componente que define o app. Botões circulares de 52 px, transparentes com anel de 1 px em `contorno`, ícone de 26 px com traço 2.4 em `ok` ou `erro`. Marcados ficam preenchidos (`ok` ou `erro`, com o texto correspondente) e perdem o anel. A marcação é manual, por campo.

### Desenhos "onde medir"

SVGs de referência com viewBox de 300 de largura, para escala perto de 1 em 360 px: texto de 15 px em 500 com contorno da cor da superfície (lê-se sobre as linhas), traço de 2.2 a 2.5, peças em `trilho`, linhas de centro traço-ponto, ocultas tracejadas, cotas e marcas em `primaria`.

### Snackbars

Fundo `inversa`, raio 8, sombra de snackbar. O aviso temporário aparece no topo, logo abaixo da barra, e não recebe toques; a barra de nova versão fica embaixo, com ações de texto em `inversa-primaria`.

## Do's and Don'ts

### Do:

- **Do** separar com tom de superfície (`fundo` → `superficie` → `superficie-alta`) antes de pensar em borda.
- **Do** manter todo alvo de toque com 48 px ou mais, e 52 a 64 px nas ações de medição e de navegação.
- **Do** usar o tom 30 (`primaria` #0842a0, `erro` #8c1d18, `ok` #0f5223) para ação e estado no tema claro.
- **Do** pôr anel de 1 px em `contorno` nos controles tonais ou transparentes no tema claro, para não sumirem ao sol.
- **Do** desenhar ícones novos em SVG na grade de 24, traço 2 px e pontas arredondadas, ao lado de texto ou com rótulo acessível.
- **Do** desligar giro, vai-e-volta e transições com `prefers-reduced-motion`; a barra contínua vira listrada e parada.
- **Do** testar cada tela nova em 360 × 740 e nos dois temas.

### Don't:

- **Don't** emoldurar cartões ou seções com bordas escuras de 2 px, nem pôr caixa dentro de caixa.
- **Don't** usar peso acima de 500.
- **Don't** usar verde, vermelho ou âmbar fora de estado, nem indicar estado só pela cor.
- **Don't** usar emoji ou símbolo Unicode como ícone: depende da fonte do aparelho e pode virar um quadrado.
- **Don't** carregar fonte externa ou de CDN; a família é a do sistema.
- **Don't** pôr sombra em nada que fica no fluxo da página.
- **Don't** pôr input abaixo de 16 px.
