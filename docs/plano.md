# Plano e estado do projeto

Prazo: **testado em campo na segunda-feira, 26/10/2026.** Aparelho: Android (Chrome).
Site: https://mauriciojts.github.io/app-campo/ (deploy automático a cada push na `main`).

## Critérios de aceite

1. Instala no celular e abre em modo avião.
2. Importa o PCM real e mostra todos os equipamentos das 6 abas (84 equipamentos, 717 itens).
3. Preencher 20 medidas, tirar 5 fotos, fechar o navegador à força, reabrir offline: tudo lá.
4. Exportar o `.xlsx` atualizado e o backup `.json` sem internet e compartilhar pelo WhatsApp.
5. Restaurar o backup em outro aparelho e os dados aparecem iguais.

## Estado das fases

| Fase                                            | Situação                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| 0. Repositório, CI, Pages                       | ✅ feito                                                                   |
| 1. Banco, importação, lista, ficha (só leitura) | ✅ feito e **validado no celular em 24/10** (critérios 1 e 2)              |
| 2. Ficha com medição                            | ✅ feito e **validado no celular em 24/10**                                |
| 3. Fotos e desenhos SVG                         | ✅ desenhos validados (24/10); fotos feitas (24/10), **testar no celular** |
| 4. Exportar, backup, restaurar, compartilhar    | ✅ feito (25/10), **testar no celular** (roteiro da fase 4)                |
| 5. Ensaio geral (critérios 1–5 no Android)      | a fazer                                                                    |

Se atrasar: os desenhos SVG (fase 3) e o `.zip` de fotos (fase 4) podem ficar para depois, porque
o backup `.json` já leva as fotos. **Nunca cortar:** gravação automática, backup e restauração.

## Fase 2 — ficha com medição (feita em 24/10)

### Como ficou

- **Ficha** (`ui/TelaEquipamento.tsx`): cabeçalho com %, divergências e avisos; "Ir para item…"
  (índice fechado, um botão por item com o estado); um cartão por item (`ui/CartaoItem.tsx`)
  cujo topo (nome + "3/7", "7/7 feito", "⚠ 7/7" ou "✗ Diverge") **gruda sob a barra** enquanto
  se mede; observação do item; "Próximo item ↓". No fim: observação do equipamento (store
  `notas`), "Próximo equipamento ›" (dentro da aba filtrada na lista; troca a ficha com
  `substituirPor`, sem empilhar histórico) e "‹ Voltar para a lista".
- A ficha **volta onde parou** (`ui/rolagem.ts`, sessionStorage); "Próximo equipamento" começa
  do topo. `history.scrollRestoration = 'manual'`: a lista e a ficha cuidam da própria rolagem.
- **Campo** (`ui/CampoMedicao.tsx`): valor do PCM ao lado do rótulo, input decimal, Δ com sinal,
  aviso de número inválido/ambíguo, opções como botões. **✓/✗ só quando há valor do PCM para
  conferir**; campo sem PCM tem **"Não tem"** (`conferencia = 'naoTem'`: conta como feito, não
  diverge; exportar como "não se aplica" na fase 4). Item com ✗ fica com borda vermelha.
  Tapete avisa LD ≠ LE (menos quando um lado é ambíguo, "12.450").
- Teclado: "próximo" vai para o próximo campo da ficha (inputs e observações, na ordem da tela).
- **Gravação** (`db/edicao.ts`): `anotar` no diário (síncrono) → fila (≤ 300 ms) → IndexedDB →
  `riscarSe` (só risca se o diário ainda guarda a mesma versão). Estado em memória
  (`ui/dados.tsx`, `alterarMedicao`/`alterarNota`) atualiza a lista na hora.
  `atualizadaEm` vem de `carimbo()`: sempre maior que o da versão anterior do registro, mesmo
  com o relógio do celular voltando.
- **Ao abrir o app**: `reaplicarDiario()` antes de `carregarDados()` — grava o que ficou no
  diário se for mais novo que o banco e risca; uma entrada que falha não para as outras. Depois
  de carregar, o que ainda está no diário e é mais novo (banco cheio) **volta para a tela e para
  a fila** (`pendentesMaisNovos`) — o indicador mostra "⚠ Celular sem espaço" até gravar.
- **Duas janelas** (app instalado + aba do Chrome): cada edição chega à outra pelo evento
  `storage` do diário; uma não apaga a medida da outra.
- **Importar** fica bloqueado enquanto houver medida na fila ou no diário.
- Revisão do `revisor-de-campo` (24/10): 3 riscos de perda de dado (banco cheio ao reabrir, duas
  janelas, relógio voltando) corrigidos com teste; atritos corrigidos (nome do item à vista,
  índice, voltar onde parou, "Não tem", selo com aviso, especificação repetida, próximo dentro
  da aba, aviso LD/LE com número ambíguo).
- Testes: `tests/unit/edicao.test.ts` (diário, corrida v1/v2, reaplicar, banco cheio,
  pendentes) e `tests/e2e/medicao.spec.ts` (20 medidas + fechar e reabrir offline; fechar 100 ms
  depois de digitar; renderer morto com SIGKILL; banco cheio ao reabrir; duas janelas; próximo
  campo/item/equipamento; opções; "Não tem", índice, topo do item e volta onde parou).
- Ficou para depois (opcional): "Adicionar item" manual (itens fora do PCM além dos tambores).

### Roteiro de teste no celular (critério 3, parte de medidas)

Ver "Roteiro — fase 2" no fim deste documento.

## Fase 3 — fotos e desenhos

- `<label>` + `<input type="file" accept="image/*">` (nunca `.click()`), compressão com
  `createImageBitmap` (orientação EXIF) → canvas ≤ 1600 px → JPEG 0,8 → Blob no store `fotos`
  (`alvoId` = item ou equipamento), miniaturas, ampliar, apagar com confirmação, foto da placa
  (motor/redutor), aviso de espaço (`navigator.storage.estimate()`).
- ✅ **Desenhos "onde medir"** (24/10, validados no celular): 15 SVGs em `src/ui/desenhos/` — tapete de cima
  (LD/LE) e em corte (coberturas, lonas), tambor, rolete (A–E e o fresado de frente),
  acionamento (motor → polias e correias → redutor com eixo vazado), motor (placa), redutor
  (maciço/vazado), acoplamento, mancal, polia, correia em V, rotor, caneca, tela, cabo de aço.
  No cartão do item, um botão por desenho ("▸ Desenho: rolete"; `<details>` fechado, o SVG só
  monta ao abrir; "▾ Fechar desenho"). Legenda curta embaixo, uma ideia por linha.
  E2E `tests/e2e/desenhos.spec.ts` (os 15 abrem; texto ≥ 14 px, traço ≥ 2 px e nada cortado em
  360 px). Como fazer um novo: skill `novo-tipo-de-item`, passo 6.
  Revisão do `revisor-de-campo` (24/10) aplicada. Mudanças nos campos:
  - tambor: rótulo "Ø ponta (redutor ou acoplamento)" (id `pontaAcoplamento` mantido);
  - motor: campo novo "Chaveta da ponta";
  - dicas "Vão livre entre fios" (malha) e "Por cima de 2 pernas opostas" (cabo de aço).

### Fotos — como ficou (24/10)

- **Onde**: "Foto do equipamento" no cabeçalho da ficha; "Foto da placa" (botão azul cheio)
  logo abaixo dos desenhos no motor e no redutor (`TemplateItem.fotoPlaca`); "Tirar foto" em
  cada cartão **antes da observação** (longe do "Próximo item"). Cada bloco tem "Galeria" ao
  lado (várias de uma vez). Miniaturas 3 por linha (`loading="lazy"`); a da placa tem o selo
  "Placa" — e se o item deixar de ser motor/redutor, ela aparece no bloco normal. Contagem no
  cabeçalho da ficha e na lista, atualizada na hora (`contarFoto` em `ui/dados.tsx`).
- **Câmera**: `<label>` + `<input type="file" accept="image/*" capture="environment">` (abre
  direto a câmera traseira); "Galeria" é o mesmo input sem `capture` e com `multiple`. Nunca
  `.click()`. Componentes em `ui/FotosDoAlvo.tsx`; ícone de câmera em SVG (emoji vira
  quadrado em aparelho sem a fonte).
- **Gravação** (`ui/fotos.ts`, `receberFotos`): **fila única, uma foto por vez no app
  inteiro** (duas fotos de 50 MP decodificadas juntas derrubam a aba). `comprimirFoto`
  (`ui/comprimir.ts`: `createImageBitmap` com `imageOrientation: 'from-image'`, alternativa
  `<img>`; canvas ≤ 1600 px; JPEG 0,8; miniatura ≤ 320 px JPEG 0,7; a original sai da memória
  antes de gerar os JPEGs) → `salvarFoto` (`durability: 'strict'`) → só então a miniatura
  aparece e a contagem sobe. Cada foto é operação crítica desde que entra na fila
  (`semRecarregarDurante`: o "Atualizar" e a importação esperam a leva inteira). Enquanto
  isso: quadrado "Salvando…" no cartão e "Salvando foto…" no topo. O estado fica no módulo:
  sair da ficha no meio não perde o "Salvando…".
- **Fotos pendentes** (`ui/fotosPendentes.ts`, localStorage): tocar no botão anota uma
  `camera`; a foto que chega vira uma anotação `foto` por arquivo, riscada só quando o banco
  confirmar (ou o técnico descartar); cancelar a câmera risca a `camera`. Ao abrir o app, o que
  sobrou (câmera ≤ 15 min, foto ≤ 24 h) vira aviso no cartão certo: "A foto não foi salva: o
  app fechou antes de gravar (o Android costuma fechar o app com a câmera aberta). Tire de
  novo…". Cobre: Android matando a aba com a câmera aberta, duas fotos seguidas, foto ainda
  gravando com a câmera aberta em outro item e o técnico fechando o app no "Salvando…". A
  ficha volta no mesmo lugar (`rolagem.ts`).
- **Falhas** (aviso no cartão **e** "⚠ Foto não salva" no topo, em qualquer tela; tocar no
  topo leva ao aviso): cota → "Celular sem espaço: N fotos não foram salvas…" (para as
  próximas da leva); outro erro → "N fotos não foram salvas"; nos dois, o arquivo original fica
  em memória e **"Tentar de novo (N)"** grava sem tirar de novo; "Descartar" desiste. Imagem que
  o navegador não abre (HEIC da galeria) → "Não consegui abrir uma imagem. Tire a foto pela
  câmera"; "Entendi" fecha.
- **Ampliar**: `<dialog>` em tela cheia (o voltar do Android fecha). Tocar na foto amplia 2,5×
  no ponto tocado e rola com um dedo (sem pinça); "Ampliar"/"Ver inteira" embaixo.
- **Apagar**: "Apagar" fica **em cima** (longe de "Ampliar" e "Fechar", embaixo). A pergunta
  "Apagar esta foto? Não dá para desfazer." aparece embaixo, com "Não, manter" na largura toda
  no lugar dos botões de antes e "Sim, apagar" acima dele — nenhum toque repetido no mesmo
  lugar apaga. Some da tela só depois que o banco confirmar.
- **Espaço** (`navigator.storage.estimate()`, `dominio/fotos.ts`): ~500 KB por foto; aviso na
  ficha abaixo de 200 fotos ("Pouco espaço no celular: cabem ~N fotos."), crítico abaixo de
  30; rodapé da lista mostra "Espaço para ~N fotos".
- **Banco**: `Foto` ganhou `miniatura?: Blob` e `daPlaca?: boolean` — campos opcionais do valor,
  sem store/índice novo, então **sem nova versão**; foto sem miniatura mostra o blob grande
  (testado). Novas: `apagarFoto`, `fotosDosAlvos` (blobs só do equipamento aberto).
- **Importar** fica bloqueado enquanto uma foto grava (`emOperacaoCritica`).
- Revisão do `revisor-de-campo` (24/10) aplicada: pendências por foto em localStorage (antes:
  uma vaga só em sessionStorage), "Sim, apagar" longe do "Fechar", "⚠ Foto não salva" no topo,
  fila única, fotos antes da observação, "Tentar de novo", placa visível sem o bloco de placa,
  erro de leitura uma vez só, miniaturas lazy.
- Testes: `tests/unit/fotos.test.ts` (dimensões, espaço, ids, pendências, banco,
  `receberFotos`: uma por vez, sem espaço → "Tentar de novo", descartar, imagem ilegível,
  apagar) e `tests/e2e/fotos.spec.ts` (JPEG de 12 MP com EXIF girado → gravado em pé 1200 ×
  1600 → fechar e reabrir offline; 5 fotos em itens diferentes com câmera, galeria e placa →
  lista e ficha contam sem recarregar → reabrir offline; apagar sem toque repetido perigoso;
  "Salvando…" até o banco confirmar; celular cheio → topo → "Tentar de novo"; pouco espaço;
  página recarregada com a câmera aberta; foto gravando + câmera em outro item; duas fotos
  seguidas; fechar no "Salvando…").
- Duas janelas abertas (app + aba do Chrome): a foto tirada numa só aparece na outra ao
  reabrir (não perde nada; só a contagem da outra fica velha).

### Fotos — para a Fase 4 (feito em 25/10)

- Backup `.json`: levar `blob` **e** `miniatura` (base64) e `daPlaca`; na restauração, foto
  sem miniatura funciona (mostra o blob). Exportar `.zip`: dá para nomear as da placa
  (`…_placa_1.jpg`).
- Lembrar que `conferencia` agora pode ser `'naoTem'` (regra na skill `exportar-pcm`).

## Fase 4 — exportar, backup, restaurar (feita em 25/10)

Regras completas na skill `exportar-pcm`. Tela **"Backup e exportar"** (`#/exportar`, pela linha
"Último backup: há X · Backup ›" no topo da lista) e **"Restaurar backup"** (`#/restaurar`, também
na tela vazia, para o outro aparelho).

### Como ficou

- **Gerar antes, enviar depois**: cada arquivo tem "Preparar…" → "Preparando… 120 de 300 fotos"
  (tela acesa com Wake Lock) → nome e tamanho + **Baixar**. Depois do toque: "✓ Baixado às 17:02
  (243 MB): está em Downloads. No WhatsApp: clipe → Documento → escolha “nome-do-arquivo”" e o
  botão vira "Baixar de novo". O Chrome do Android **não compartilha** .json/.xlsx/.zip pelo Web
  Share (só imagem/áudio/vídeo/PDF/texto, até 50 MB): no Android só aparece "Baixar"; fora dele
  aparece também "Compartilhar" (recusado → baixa na hora). Decisão do usuário (25/10).
- **Lembrete**: "Último backup: há 5 h · 35 itens e 12 fotos depois ›" no topo da lista; fica
  amarelo com mudanças depois do último backup há mais de 4 h (ou nenhum backup com dados) e,
  nesse caso, aparece também no fim da ficha (quem vai de "Próximo equipamento" não passa pela
  lista).
- **Planilha** (`exportar/planilha.ts`): parte do arquivo original; 4 colunas depois da última
  usada (Medido, Confere/Diverge, Observação, Data); "Não tem" → "não se aplica"; ✓ sem valor →
  "conforme PCM"; abas "Resumo" e "Fora do PCM" (tambores e órfãos). **Reimportar o .xlsx no app
  dá o mesmo PCM** (pedido do usuário): abas do app marcadas na A1 e ignoradas pelo parser,
  reexportar reaproveita as colunas. Conferido com o PCM real: 84 equipamentos, 717 itens nas
  linhas certas, reimportação idêntica (1ª e 2ª exportação), 0 células originais alteradas.
  Limite: SheetJS gratuito não grava fontes/bordas/cores (fica para a sessão de aparência).
- **Backup .json** (`exportar/backup.ts`, `lerBackup.ts`): formato na skill (cabeçalho com
  `resumo` no começo, fotos por último, uma por linha, blob + miniatura em base64, `daPlaca`).
  Gerado em pedaços de Blob (nunca uma string gigante); lido em fatias de 1 MB, um registro por
  vez. Leva também o que ainda está só no diário (banco cheio).
- **Restaurar** (`exportar/restaurar.ts`): sem `accept` no seletor (o Android esconde .json do
  WhatsApp) e com a dica de onde achar o arquivo; valida tudo (não é backup, cortado, versão mais
  nova — inclusive tipo de item desconhecido —, registro estragado, contagens); prévia "o que
  entra × o que será trocado"; se o celular tem algo que o backup não tem (medida mais nova, mais
  itens ou fotos), **aviso vermelho e 2ª confirmação** com o "Não" no lugar do botão tocado.
  Bloqueia como a importação. **Durante a restauração o app mostra só essa tela** (sem "‹ Lista",
  o voltar do Android não sai). **Cópia automática** do estado atual gravada **na mesma transação**
  da restauração (se falhar, nada muda, nem as cópias); ficam as **2 últimas**
  (`meta.copiaAntesDeRestaurar:<data>`), cada uma com "Voltar para esta cópia", Baixar e "Apagar
  esta cópia" (com confirmação). A transação confere a "impressão" dos dados (cada medição/nota
  com seu `atualizadaEm`, ids das fotos e importações): se algo mudou desde a cópia (outra janela),
  aborta. Outra janela aberta recarrega sozinha depois.
- **Revisão do `revisor-de-campo` (25/10)**: 2 riscos de perda de dado corrigidos com teste antes
  (medir durante a restauração era apagado — reproduzido no navegador; a única cópia era trocada
  antes de a restauração dar certo). Atritos corrigidos: prévia que compara, retorno do "Baixar",
  texto do WhatsApp com o nome do arquivo, só "Baixar" no Android, lembrete por mudanças, lembrete
  no fim da ficha, dica de onde achar o arquivo, tela acesa, trava contra toque duplo, "voltar para
  a cópia" em um toque, tipo desconhecido = versão mais nova. Ficou de fora: avisar antes de baixar
  se faltar espaço (a estimativa do navegador não é o espaço livre do celular; o texto pós-download
  explica "Falha no download").
- **Bug achado nos testes e corrigido** (`db/repositorio.ts`, `tudoOuNada`): um `put()` recusado na
  hora pelo IndexedDB não aborta a transação sozinho — na restauração os `clear()` seriam gravados
  (aparelho vazio); na importação, idem. Agora toda gravação em várias stores aborta em qualquer
  erro. Testes em `backup.test.ts` e `banco.test.ts` (falham sem a correção).
- **Fotos .zip** (`exportar/zip.ts`): zip STORE próprio, as fotos entram por referência (o JSZip
  montaria tudo na memória e ficou só nos testes). Nomes `XA-TC-01_MOTOR_1.jpg`, `_GERAL_`,
  `_MOTOR_PLACA_1`, sem TAG = nome do equipamento; nunca repete.

### Medição (Chromium, CPU 4× mais lenta, 300 fotos de ~600 KB = 182 MB)

| Etapa                                      | Tempo  | Heap JS (pico) |
| ------------------------------------------ | ------ | -------------- |
| Gerar backup → arquivo de **243 MB**       | 14,9 s | 3 MB           |
| Gerar zip das fotos                        | 3,5 s  | 3 MB           |
| Gerar planilha                             | 0,4 s  | 6 MB           |
| Ler e validar o backup (outro aparelho)    | 5,5 s  | 21 MB          |
| Gravar a restauração                       | 0,3 s  | 15 MB          |
| Restaurar por cima, com cópia de 300 fotos | 16,4 s | 10 MB          |

Com 400 fotos (243 MB de fotos): backup de **324 MB** em 19,6 s; ler 7,5 s; restaurar por cima
com cópia 20,5 s; heap JS ≤ 19 MB em todas as etapas.

Os Blobs ficam no processo principal do navegador: no Android, só 1% da RAM fica em memória e o
resto vai para arquivo temporário (até 6% do armazenamento). Restaurar por cima de 300 fotos pede
espaço livre temporário de ~1 GB (cópia + fotos novas + antigas até o fim); sem espaço, nada muda.
Tempos de celular real: medir no roteiro.

### Testes

`tests/unit/backup.test.ts` (ida e volta com bytes, fatias de 1 byte a 64 KB, inválidos,
cortado em vários pontos, atomicidade, cópia automática, diário no backup), `planilha.test.ts`
(.xls e .xlsx: colunas, células originais, reimportação igual, reexportação, órfãos, linha
errada), `exportar.test.ts` (textos, nomes, zip lido pelo JSZip) e `tests/e2e/exportar.spec.ts`
(backup offline → outro contexto limpo → restaurar igual até os bytes + zip; .xlsx lido de volta,
"Compartilhar" recusado → baixa, reimportar no app; restaurar inválido não mexe em nada e o
válido guarda a cópia).

## Notas operacionais

- Push: o remoto é HTTPS e usa o login do `gh` (configurado só neste repositório).
- Capturas de tela em 360 px: `npm run build && npm run preview -- --port 4174` e um script
  Playwright fora do repositório (scratchpad).
- CI: as actions `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`,
  `upload-artifact@v4` avisam "Node 20 deprecated" (funcionam). Atualizar depois do campo.

## Roteiro — fase 2 (no Android, ~15 min)

Preparação: com internet, abrir o app instalado → aparece "Nova versão do app" → **Atualizar**
(se não aparecer, feche e abra de novo). Confira que as medidas antigas (se houver) continuam.

1. **Modo avião ligado.** Abrir o app pelo ícone. Abrir uma transportadora com tapete.
2. Tapete: digitar Largura, Lonas, Comprimento. Ver o valor do PCM ao lado e o **Δ** com sinal.
   Tocar ✓ num campo e ✗ em outro: o cartão fica vermelho com "✗ Diverge" e o topo da ficha
   mostra "✗ 1 diverge". Tocar o ✗ de novo desmarca. Num tambor, tocar **"Não tem"** num campo
   que não existe (ex.: ponta do acoplamento do tambor de retorno): o "3/7" sobe.
3. Digitar **com vírgula** (`658,4`) e com ponto (`658.4`): os dois aceitam. Digitar `12.450`:
   tem que perguntar "é 12450 ou 12,450?". Digitar `65O` (letra O): avisa "Use só números".
4. Centro a centro LD = `12450` e LE = `12480`: aparece "LD e LE diferentes: 30 mm".
5. Tecla **"próximo"** do teclado: pula para o campo seguinte (e para a observação no fim do
   item). O campo focado não pode ficar escondido atrás do teclado nem da barra do topo.
6. "Próximo item ↓": o item seguinte aparece no topo, logo abaixo da barra. Ao rolar dentro de
   um item, o **nome dele fica preso no topo**. "Ir para item…" pula direto para o motor.
7. Preencher **20 medidas** em vários itens (roletes, redutor, motor) e as duas observações.
8. Sem esperar, **fechar à força**: botão de recentes → arrastar o app para fora.
   Reabrir pelo ícone (ainda em modo avião): **as 20 medidas, ✓/✗ e observações estão lá**.
9. **Fechar logo depois de digitar**: digitar um valor e, em menos de 1 s, ir aos recentes e
   fechar o app. Reabrir: o valor está lá.
10. Voltar à lista: a linha do equipamento mostra a % e "✗ 1 diverge" sem recarregar. Abrir a
    mesma ficha de novo: ela **volta onde você parou**.
11. No fim da ficha, "Próximo equipamento ›" abre o seguinte; o **voltar do Android** leva à
    lista (não volta para a ficha anterior).
12. Repetir 2–3 com **luva** e no **sol**, tema claro e escuro (botão "Tema" no fim da lista).
13. Se a aba do Chrome usada para instalar ainda estiver aberta: medir um campo nela e outro no
    app instalado, no mesmo item; fechar os dois e reabrir — os dois valores ficam.

Anote o que travou, o que ficou pequeno/apagado ao sol e qualquer medida que sumiu (com o
horário) — medida sumida vira teste antes da correção.

## Roteiro — desenhos (no Android, ~5 min)

1. Atualizar o app (com internet) e abrir uma transportadora em modo avião.
2. Em cada item, tocar "▸ Desenho: …": abre o desenho com a legenda; "▾ Fechar desenho" fecha.
3. Conferir ao sol, tema claro e escuro: letras e nomes legíveis e iguais aos campos da ficha.
4. Conferir se cada desenho mostra o que você mede de verdade em campo (fresado, LD/LE, Ø do
   cabo, malha, eixo vazado). O que estiver errado ou confuso: anote qual desenho e o porquê.

## Roteiro — fotos (no Android, ~20 min)

Preparação: com internet, abrir o app instalado → "Nova versão do app" → **Atualizar**.
Conferir que as medidas antigas continuam. No rodapé da lista, anotar "Espaço para ~N fotos".

1. **Modo avião ligado.** Abrir o app pelo ícone e uma transportadora com motor e redutor.
2. **Foto do equipamento** (no topo da ficha): tem que abrir **direto a câmera traseira**.
   Tirar e confirmar (✓ da câmera). Volta para a ficha no mesmo lugar; aparece "Salvando…"
   e logo depois a miniatura; no topo "✓ Salvo no aparelho"; no cabeçalho "1 foto".
3. **De luva**, no motor: **"Foto da placa"** (botão azul cheio). Tirar 1 foto da placa.
   A miniatura tem o selo "Placa". Tocar nela: abre em tela cheia. Tocar em cima dos dados da
   placa: amplia ali; arrastar com um dedo e ler potência/rotação. "Ver inteira", "Fechar".
   Abrir de novo e usar o **voltar do Android**: só a foto fecha, a ficha continua.
4. **5 itens diferentes**: "Tirar foto" no tapete, num rolete, num mancal, no redutor e no
   motor. Voltar à lista: a linha mostra "N fotos" sem recarregar. Abrir a ficha de novo.
5. **Galeria**: fora do app, tirar 2 fotos com a câmera do celular. No app, "Galeria" de um
   item e escolher as 2 de uma vez: aparecem 2 miniaturas.
6. **Apagar**: abrir uma foto → "Apagar" (em cima) → tem que perguntar embaixo. Tocar onde
   estava o "Fechar": é o "Não, manter" (continua). "Apagar" → "Sim, apagar": some e a
   contagem diminui.
7. **Fechar à força** (recentes → arrastar o app) e reabrir em modo avião: todas as fotos,
   a da placa e as contagens estão lá. Depois: tirar uma foto e fechar o app **enquanto
   aparece "Salvando…"** — ao reabrir, ou a foto está lá, ou o cartão avisa "A foto não foi
   salva" (nunca some calada).
8. **Android recarregando ao voltar da câmera**: abrir antes vários apps pesados (jogo,
   YouTube, Maps) para encher a memória. Digitar uma medida, tocar "Tirar foto", ficar 1–2 min
   na câmera e tirar a foto. Duas saídas aceitáveis:
   - a página não recarregou: a foto aparece normalmente;
   - a página recarregou (pisca, "Abrindo…"): a ficha volta no mesmo item, a medida digitada
     está lá e o cartão diz **"A foto não foi salva: o app fechou antes de gravar… Tire de
     novo"** (e o topo, "⚠ Foto não salva").
     Repetir umas 5 vezes e anotar quantas recarregaram. Se for frequente, o caminho seguro é a
     câmera do celular + "Galeria".
9. **Foto que não abre**: se o celular salvar fotos em HEIC/HEIF, escolher uma pela
   "Galeria": tem que aparecer "Não consegui abrir uma imagem…" (nada some).
10. Repetir 2–3 **ao sol**, tema claro e escuro: miniaturas, "Salvando…" e botões visíveis.

Anote: foto que sumiu (com horário e item), câmera que não abriu, quantas vezes a página
recarregou no passo 8, o que ficou pequeno ou difícil de luva. Foto sumida vira teste antes
da correção.

## Roteiro — fase 4: exportar, enviar e restaurar (critérios 4 e 5, ~25 min)

Precisa: o celular de campo com medidas e fotos, **um segundo celular Android** (ou de um colega)
e o WhatsApp. Preparação: com internet, abrir o app nos dois → "Nova versão do app" →
**Atualizar**. No segundo celular, se o app ainda não estiver instalado: abrir o site com internet
e instalar ("Adicionar à tela inicial").

**Celular de campo (critério 4)**

1. **Modo avião ligado.** Abrir o app. No topo da lista: "Nenhum backup ainda" (amarelo) ou
   "Último backup: há …". Tocar a linha ("Backup ›").
2. "Preparar backup": aparece "Preparando… N de M fotos" e depois o nome e o tamanho. **Anotar o
   tempo e o tamanho.**
3. **"Baixar"**: o Chrome avisa o download. Voltar à lista: "Último backup: agora há pouco".
4. Na tela aparece "✓ Baixado às …: está em Downloads" com o nome do arquivo, e o botão vira
   "Baixar de novo". (No Android não há "Compartilhar": o Chrome não compartilha .json.) Abrir o
   app "Arquivos"/"Downloads" do celular e conferir que o arquivo está lá com o tamanho certo.
5. **WhatsApp, ainda em modo avião**: uma conversa (pode ser com você mesmo) → **clipe →
   Documento** → achar `levantamento-backup-….json` (Downloads, "Recentes" ou "Procurar outros
   documentos") → enviar. Fica com o reloginho; ao desligar o modo avião, envia. **Anote o caminho
   exato que o WhatsApp mostrou** (para acertar o texto do app).
6. "Preparar planilha" → **Baixar** → mandar pelo WhatsApp do mesmo jeito. No PC: abrir no Excel;
   na linha de cada item medido, as colunas **Medido, Confere/Diverge, Observação, Data**; abas
   **Resumo** e **Fora do PCM** (tambores). Conferir 3–4 itens contra o que você mediu.
7. "Preparar fotos" → Baixar → abrir o `.zip` no gerenciador de arquivos: nomes como
   `XA-TC-01_MOTOR_1.jpg` (com a TAG real) e as fotos abrem.
8. **PCM atualizado de volta no app**: lista → "Trocar o PCM" → escolher o `pcm-atualizado-….xlsx`
   em Downloads → a prévia diz "Nada será apagado" e **não** fala em "mudaram de linha" nem
   "Fora do PCM atual" → trocar → medidas e fotos continuam nas fichas.

**Segundo celular (critério 5)**

9. **Modo avião ligado** depois de receber o backup no WhatsApp (tocar no documento para baixar)
   ou no Drive (baixar para o celular).
10. Abrir o app: "Nenhum PCM neste aparelho" → **"Restaurar backup"** → "Escolher arquivo do
    backup" → achar o `.json` (Downloads; do WhatsApp: "Recentes" ou a pasta
    WhatsApp/Media/WhatsApp Documents). "Lendo… %" → a prévia mostra data, PCM e os números
    (equipamentos, itens medidos, observações, fotos) e "Este celular está vazio".
11. **"Restaurar este backup"** → "✓ Backup restaurado" → "Ir para a lista": mesmos equipamentos
    e %. Abrir 3 fichas: medidas, ✓/✗, "Não tem", observações e fotos iguais; abrir uma foto da
    placa em tela cheia e ler. **Anotar o tempo de "Lendo" e de "Restaurando".**
12. Fechar o app à força e reabrir (modo avião): tudo continua.

**Proteções (no segundo celular)**

13. Medir um campo novo (ex.: Largura = 999). Restaurar o mesmo backup de novo: a prévia avisa
    **em vermelho** "Este celular tem dados que o backup não tem…" → "Restaurar este backup" →
    no lugar do botão aparece "Não, manter os dados deste celular" (tocar duas vezes no mesmo
    lugar não restaura) → "Sim, trocar tudo pelo backup" → aparece **"Cópia de antes da
    restauração"**; a Largura volta ao valor do backup. **"Voltar para esta cópia"** → restaurar:
    o 999 volta e agora há 2 cópias.
14. Durante "Guardando cópia… / Restaurando…", tentar o **voltar do Android**: a tela não sai.
15. Na tela de restaurar, escolher a planilha `.xlsx` (arquivo errado): "Este arquivo não é um
    backup do app… Nada foi alterado." — e nada mudou.

Anote: tempos e tamanho, onde o arquivo foi parar, o que não apareceu no seletor de arquivos,
qualquer diferença entre os dois celulares (com o item e o campo). Dado diferente ou sumido vira
teste antes da correção.

## Ideias para a sessão de aparência e usabilidade

Anotadas na Fase 4 (sem mexer agora):

- **Planilha**: bordas finas, negrito nos títulos, quebra de texto e largura certa nas 4 colunas
  novas; "Diverge" em vermelho; congelar o cabeçalho (pós-processar o `.xlsx`: `styles.xml`).
- **Backup e exportar**: tela comprida (4 cartões). Backup em destaque no topo; planilha e fotos
  mais compactas; restaurar como link no fim.
- Arquivo pronto: o nome longo quebra em 2 linhas — mostrar "Backup de 26/10 14:30 · 243 MB" e
  o nome em letra menor. Ícones de baixar/compartilhar nos botões. O bloco "✓ Baixado às…" tem
  4 frases: enxugar depois de ver no celular qual caminho o WhatsApp mostra.
- Cópias de antes da restauração: cada uma tem 3–4 botões (voltar, baixar, apagar) — agrupar.
- "Preparando… 120 de 300 fotos": barra de progresso.
- Lista: a linha "Último backup" e o aviso "Instale o app" ficam empilhados no topo — juntar num
  bloco só de "estado do aparelho".
- Restaurar: prévia em tabela (backup × este celular) em vez de frase; "Restaurar este backup"
  quebra em 2 linhas a 360 px.
- O toast ("PCM importado…") cobre botões no fim da tela por 5 s.
