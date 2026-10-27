# Plano e estado do projeto

Prazo: **testado em campo na segunda-feira, 26/10/2026.** Aparelho: Android (Chrome).
Site: https://mauriciojts.github.io/app-campo/ (deploy automático a cada push na `main`).

## Critérios de aceite

1. Instala no celular e abre em modo avião.
2. Importa o PCM real e mostra todos os equipamentos das 6 abas (84 equipamentos, 717 itens).
3. Preencher 20 medidas, tirar 5 fotos, fechar o navegador à força, reabrir offline: tudo lá.
4. Exportar o `.xlsx` atualizado e o backup `.json` sem internet e compartilhar pelo WhatsApp.
5. Restaurar o backup em outro aparelho e os dados aparecem iguais. ✅ validado em 26/10.

## Estado das fases

| Fase                                            | Situação                                                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Repositório, CI, Pages                       | ✅ feito                                                                                                                                                        |
| 1. Banco, importação, lista, ficha (só leitura) | ✅ feito e **validado no celular em 24/10** (critérios 1 e 2)                                                                                                   |
| 2. Ficha com medição                            | ✅ feito e **validado no celular em 24/10**                                                                                                                     |
| 3. Fotos e desenhos SVG                         | ✅ desenhos validados (24/10); fotos feitas (24/10), **testar no celular**                                                                                      |
| 4. Exportar, backup, restaurar, compartilhar    | ✅ feito (25/10); exportar e enviar pelo WhatsApp **validado no celular em 25/10** (critério 4); restaurar em outro aparelho **validado em 26/10** (critério 5) |
| Aparência e usabilidade em campo                | ✅ feito (25/10): telas de backup e restaurar, estado do aparelho, toast, letras pequenas, `.xlsx` formatado; **conferir no celular**                           |
| Visual novo (Material 3) e ficha em guias       | ✅ feito, publicado (26/10, `58d01ce`) e **validado no celular em 26/10** ("funcionou corretamente")                                                            |
| Mancal dos tambores nas linhas do PCM           | ✅ feito e publicado (26/10, `c1b2539`): a planilha preenche MANCAL/ROLAMENTO/BUCHA com o anotado nos tambores; exportação **conferida no celular em 26/10**    |
| Croqui das medidas externas                     | 9 formatos publicados (26/10, `a42e522` e `c6b26a2`); **conferir no celular** (Trocar o PCM com o mesmo arquivo); ver `docs/croqui.md`                          |
| 5. Ensaio geral (critérios 1–5 no Android)      | a fazer                                                                                                                                                         |

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
  (243 MB): está em Downloads. Para mandar: app de arquivos do celular → Downloads → segure
  “nome-do-arquivo” → Compartilhar → WhatsApp" e o botão vira "Baixar de novo". **Testado no
  Android em 25/10**: o "clipe → Documento" do WhatsApp não lista o .json; pelo app de arquivos
  (Compartilhar → WhatsApp) foram o .xlsx e o .json. O Chrome do Android **não compartilha** .json/.xlsx/.zip pelo Web
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
  Formatação (negrito, bordas, "Diverge" em vermelho, cabeçalho congelado): ver "Aparência e
  usabilidade" abaixo.
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
  (`meta.copiaAntesDeRestaurar:<data>`), cada uma com "Restaurar esta cópia", Baixar e "Apagar
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
4. Embaixo do botão aparece "✓ Baixado às …: está em Downloads" e o caminho para mandar; o nome
   do arquivo fica em letra menor acima do botão, que vira "Baixar de novo". (No Android não há "Compartilhar": o Chrome não compartilha .json.) Abrir o
   app "Arquivos"/"Downloads" do celular e conferir que o arquivo está lá com o tamanho certo.
5. **Ainda em modo avião**: app de arquivos do celular → **Downloads** → segurar
   `levantamento-backup-….json` → **Compartilhar → WhatsApp** → uma conversa (pode ser com você
   mesmo) → enviar. Fica com o reloginho; ao desligar o modo avião, envia. (O "clipe → Documento"
   do WhatsApp não lista .json — validado em 25/10.)
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
    restauração"**; a Largura volta ao valor do backup. **"Restaurar esta cópia"** → restaurar:
    o 999 volta e agora há 2 cópias.
14. Durante "Guardando cópia… / Restaurando…", tentar o **voltar do Android**: a tela não sai.
15. Na tela de restaurar, escolher a planilha `.xlsx` (arquivo errado): "Este arquivo não é um
    backup do app… Nada foi alterado." — e nada mudou.

Anote: tempos e tamanho, onde o arquivo foi parar, o que não apareceu no seletor de arquivos,
qualquer diferença entre os dois celulares (com o item e o campo). Dado diferente ou sumido vira
teste antes da correção.

## Aparência e usabilidade (feita em 25/10)

Sem funcionalidade nova e sem mexer no esquema do IndexedDB nem na lógica de gravação, backup,
restauração ou importação. Capturas antes/depois em 360 px (claro e escuro) e auditoria: o
contraste já estava alto (texto secundário ~10:1 nos dois temas) e nenhum alvo de toque < 48 px.

- **Lista**: "Último backup" e os avisos ("Instale o app…", "sem internet") num bloco só de estado
  do aparelho (`ui/EstadoDoAparelho.tsx`). A linha de backup tem ícone e a 2ª linha "35 itens e
  12 fotos ainda sem backup". O rodapé continua com o estado completo.
- **Toast** ("PCM importado…") no topo, logo abaixo da barra: não cobre mais os botões do fim, e
  só aparece na tela em que nasceu (não acompanha a troca de tela). A resposta ao "Atualizar"
  ("Ainda salvando medidas…") aparece dentro da própria barra de baixo, perto do dedo.
- **Ficha**: selo "PCM", nome da aba e selos de 13,5–14,4 px → 15,3 px; barra de progresso mais
  grossa e com fundo visível ao sol (`--barra-fundo`). "Foto do equipamento" e "Foto da placa"
  continuam em 2 linhas no botão (cabem em 360 px só sem o "Galeria" ao lado; ficou assim).
- **Backup e exportar**: backup em destaque (borda azul, botão grande); planilha e fotos compactas
  em "Outros arquivos"; "Restaurar um backup ›" como link no fim; ícones SVG (`ui/Icones.tsx`);
  barra de progresso (`ui/Progresso.tsx`, também no Lendo/Guardando cópia/Restaurando); arquivo
  pronto: "Pronto para baixar" (some depois do toque), "Backup de 26/10 14:30" e, embaixo, em
  letra menor, "243 MB · nome-do-arquivo.json" (o tamanho no título quebrava a linha em 360 px);
  depois de baixar, o aviso fica **embaixo** do botão (nada muda de lugar sob o dedo) em 2 linhas
  - nota de "Falha no download"; "Preparar de novo" virou botão-texto a 16 px do "Baixar". Sem
    backup nenhum, também mostra "N itens e M fotos ainda sem backup" (aqui e na lista).
- **Restaurar**: prévia em tabela Backup × Este celular ("Dados até", equipamentos, itens medidos,
  obs. de equipamento, fotos); o que o celular tem a mais fica em vermelho com ⚠; aviso de risco
  mais curto; "Restaurar este backup" numa linha (botões grandes com 12 px de folga lateral).
  Na linha "Dados até", se o celular mudou no mesmo minuto do backup, as duas datas aparecem com
  segundos e a célula vermelha diz "mais novo" (senão as colunas pareciam iguais).
  Cada cópia: título "Cópia de 25/10 17:11", "Restaurar esta cópia" (antes "Voltar para esta
  cópia", que parecia navegação) e [Baixar | Apagar]
  lado a lado; "Apagar" pede confirmação com "Não, manter a cópia" no lugar.
- **Planilha .xlsx**: negrito e fundo nos cabeçalhos (cinza = PCM, azul-claro = colunas e abas do
  app), bordas e quebra de texto nas 4 colunas até o último item da aba, "Diverge…" e divergências
  em vermelho, cabeçalho congelado, linhas mais altas quando o texto quebra
  (`exportar/formatoPlanilha.ts`, detalhes na skill `exportar-pcm`). Reimportação continua igual
  (conferido com o PCM real: 0 de 3.073 células originais alteradas).
- Revisão do `revisor-de-campo` (25/10): nada com perda de dado; aplicado: datas iguais na prévia
  (segundos + "mais novo"), "Preparar de novo" longe do "Baixar", toast preso à tela,
  "Pronto para baixar", tamanho fora do título, contagem sem backup, "Restaurar esta cópia" e erro
  ao apagar cópia avisado.
- Testes novos: `planilha.test.ts` (formatação lida do XML, painel congelado, zip igual,
  reexportação), `exportar.spec.ts` (tabela da prévia, botão numa linha, barra de progresso,
  `.xlsx` formatado no navegador), `importar.spec.ts` (toast no topo).

Ficou para depois (opcional): "Medido" com um campo por linha na planilha (muda o texto
exportado); manter a formatação original do PCM (exigiria editar o `.xls` binário).

## Visual novo: Material 3 (26/10, mesclado na `main`)

Feito com a skill `impeccable` depois da reclamação "tudo em negrito, molduras e caixas pesadas".
Na rodada de direção, o usuário escolheu o **padrão da categoria**: Material 3 do Android, na régua
dos apps do Google (Arquivos, Keep, Configurações). Produto em `PRODUCT.md`, sistema visual em
`DESIGN.md`. **Só aparência**: nada em banco, gravação, backup, restauração nem importação (as
duas revisões conferiram no diff).

- Tokens do Google M3 (`src/estilos.css`): fundo `#f0f4f9`/`#131314`, cartões sem moldura (raio
  20), Roboto do sistema em 400/500, botões em pílula (preenchido, tonal, texto), campos
  preenchidos com linha inferior, ícones SVG (`src/ui/Icones.tsx`) no lugar de ✓ ✗ ⚠ ‹ › ▸ ▾ ↓.
- O campo vence a especificação (revisão de campo): azul, verde e vermelho no tom 30 (≥ 9:1 ao
  sol), anel de 1 px nos botões tonais no tema claro, linha de 2 px escura no campo vazio, chips
  marcados preenchidos, "Salvo no aparelho" verde, voltar com área de 64 × 56.
- Revisão final da skill: ship, depois de 2 rodadas de correção. A diferença entre 400 e 500
  (Roboto) só se vê no celular, porque as capturas usam a fonte do Linux.
- Testes: os textos sem glifo ("Salvo no aparelho", "Diverge", "Foto não salva"…) e os seletores
  foram ajustados; 288 unitários e 36 E2E passam.

### Ficha em guias, como no protótipo de campo (26/10, mesmo branch)

Depois do campo de 26/10 (o usuário disse que "funcionou corretamente"), a melhoria pedida foi
voltar à organização do protótipo antigo (o artifact do claude.ai), mantendo o visual novo, com o
desenho de cada guia no alto. Nada do protótipo foi copiado: ele tem dados reais do cliente.

- Ficha em guias (`src/dominio/guias.ts`, `src/ui/Guias.tsx`, `src/ui/TelaEquipamento.tsx`):
  - guias **PCM · Correia · Tambores · Roletes · Acionamento · Outros · Fotos · Notas**;
  - só aparecem as guias de medida que têm item; sem tambor, a guia dos mancais se chama
    "Mancais";
  - a barra de chips (48 px) fica presa sob o topo e rola de lado sozinha; cada chip mostra ✓
    (tudo feito), ✗ (diverge) ou o número de fotos;
  - a guia aberta fica no endereço (`#/equipamento/<id>/<guia>`, trocada sem empilhar
    histórico) e na sessão: o Android recarregando depois da câmera volta na mesma guia e no
    mesmo lugar.
- Guia **PCM**: as linhas da planilha (item, especificação, qtd., selo). Tocar leva ao item, na
  guia dele; substitui o "Ir para item…".
- Guia **Fotos**: a foto do equipamento (saiu do cabeçalho) e quantas fotos cada item tem.
- Guia **Notas**: a observação do equipamento e, no fim, "Próximo equipamento".
- Fim de cada guia: "Seguir para X". O "Próximo item" anda dentro da guia.
- **Desenho no alto** de cada guia de medida, aberto, com "Ocultar" (lembrado no aparelho):
  - Correia: vista de cima;
  - Tambores: tambor (sem tambor: mancal);
  - Roletes: código do rolete;
  - Acionamento: acionamento.

  Os outros desenhos seguem nos cartões.

- **Tambor com mancal**: cada tambor ganhou os campos Mancal (código gravado), Rolamento e Bucha,
  num bloco "Mancal e rolamento". O PCM vem das linhas MANCAL/ROLAMENTO/BUCHA do mesmo
  equipamento. As linhas do PCM continuam no fim da guia (a coluna "Medido" da planilha depende
  delas). Os campos novos são só chaves novas nas medições: o esquema não mudou, e o tambor
  passa de 7 para 10 campos no progresso.
- **Visual mais próximo do protótipo**:
  - guia aberta em tinta;
  - cotas dos desenhos em âmbar e a peça medida em amarelo claro (tokens `desenho*`);
  - títulos da ficha em Roboto Condensed do sistema, em negrito;
  - "PCM: [valor]" embaixo do nome do campo.
- Conferência com o PCM real (só contagens):
  - todos os 762 itens caem numa guia de medida;
  - os 45 tambores trazem o PCM do mancal e do rolamento, e 37 o da bucha;
  - a planilha exportada reimporta igual, com 0 de 3.073 células alteradas.

**Publicação**: o branch `visual-novo` foi mesclado na `main` em 26/10, a pedido do usuário, e
publicado no mesmo dia (`58d01ce`, deploy verde e conferido offline). O usuário fez o roteiro abaixo
no celular em 26/10: "funcionou corretamente".

## Mancal dos tambores nas linhas do PCM (26/10)

Decisão do usuário (26/10): a planilha exportada preenche as linhas MANCAL, ROLAMENTO e BUCHA do
PCM com o que foi anotado nos tambores do mesmo equipamento. Só a exportação mudou; app, banco,
backup e importação ficaram iguais.

- **Medido**: o que foi anotado na própria linha e, no fim,
  `Nos tambores: Tambor 1: SNA 515 · Tambor 2: SNA 516`. "Não tem" → "não se aplica"; ✓ sem valor
  → "conforme PCM".
- **Confere/Diverge**: um ✗ no campo do tambor faz a linha divergir (`Diverge: Tambor 2`, em
  vermelho); só ✓ → "Confere".
- **Data**: a mais recente, contando os tambores que têm algo naquele campo.
- Linha sem nada anotado nela mesma sai preenchida se algum tambor tiver o campo.
- **Duas linhas do mesmo tipo** no equipamento (11 casos no PCM real): o nome da linha não diz
  qual é o tambor, então as duas levam todos os tambores, como a dica "Nos tambores" da tela.
- O tambor continua inteiro na aba "Fora do PCM"; a nota da aba avisa que o mancal, o rolamento e
  a bucha também vão para as linhas do PCM.
- Conferência com o PCM real (só contagens, valores inventados nos 45 tambores): as 71 linhas
  MANCAL/ROLAMENTO/BUCHA dos equipamentos com tambor saem preenchidas; 0 de 3.073 células
  originais alteradas; a planilha reimporta igual.

Código: `nosTambores` em `src/exportar/textos.ts` (regra da linha → campo do tambor em
`campoDoTambor`, `src/dominio/guias.ts`); teste em `tests/unit/planilha.test.ts`.

### Roteiro — visual novo no celular (~10 min, sol e luva, claro e escuro)

Depois do push: abra o app com internet e toque em **Atualizar**; medidas e fotos continuam. Para
ver antes do push, use o build local: no PC, na `main`, `npm run build && npm run preview -- --host`
e, no celular, na mesma rede, abra
`http://<ip-do-pc>:4173`. É outra origem: os dados de campo **não** aparecem ali, e sem HTTPS o modo offline não liga (a conferência é só visual, com o PC servindo). Importe a planilha
fictícia ou uma cópia.

1. Lista: o bloco "Último backup ›" e a faixa amarela separados; busca e filtro de aba em pílula.
2. Ficha ao sol: o campo de medida **vazio** aparece (fundo cinza e linha escura embaixo)? O
   rótulo, o "PCM 660,4 mm" e o Δ se leem? A seta de voltar (canto superior esquerdo) pega de
   primeira com luva?
3. ✓/✗: circulares de 52 px; marcado = cheio. "Não tem" e opções marcadas ficam azuis cheios,
   fáceis de distinguir do desmarcado?
4. "Salvo no aparelho" verde; enquanto grava, "Salvando…" neutro com as setas girando.
5. Peso das letras: títulos em médio (500), texto normal (400). Ficou menos "grosseiro"?
6. Backup e exportar, Restaurar: mesmas ações de hoje, no visual novo.
7. Guias: com luva, a barra de guias rola de lado e o toque pega a guia certa? A guia aberta
   (tinta escura) se distingue ao sol? O ✓/✗ no chip aparece?
8. Desenho no alto: abre já aberto; "Ocultar" recolhe e continua recolhido no próximo
   equipamento. As cotas em âmbar se leem ao sol?
9. Tambores: preencha o mancal e o rolamento de um tambor, troque de guia logo em seguida e
   feche o app pelos recentes. Reabra: o valor está lá?
10. Câmera numa guia que não é a primeira (ex.: Acionamento, foto da placa do motor): ao voltar
    da câmera, a ficha está na mesma guia e no mesmo lugar?
11. "Seguir para…" no fim de cada guia, até Notas e "Próximo equipamento".

Anote o que ficou pior que a versão de antes (com a tela e o tema). Isso volta numa correção.

## Roteiro — conferência visual (no Android, ~10 min, sol e luva)

Preparação: com internet, abrir o app → "Nova versão do app" → **Atualizar**. Medidas e fotos
continuam. Fazer cada passo no **tema claro e no escuro** (botão "Tema" no fim da lista), **ao
sol** e **de luva**.

1. **Lista**: no topo, um bloco só com "Último backup…" (e "N itens e M fotos ainda sem backup")
   e, se houver, a faixa amarela "Instale o app…". Dá para ler ao sol? Tocar no bloco → abre
   "Backup e exportar".
2. **Ficha**: o selo "PCM" e o valor do PCM ao lado de cada campo, o nome da aba e a barra de %
   no cabeçalho se leem sem apertar os olhos? A barra de % aparece mesmo vazia?
3. **Backup e exportar**: o backup é a primeira coisa e a mais destacada? "Preparar backup" → a
   barra anda com "N de M fotos" → aparece "Backup de 26/10 14:30 · … MB" → **Baixar** → embaixo:
   "✓ Baixado às…" e o caminho para mandar. O caminho é fácil de seguir com uma mão?
4. "Preparar planilha" → Baixar → abrir no Excel (PC ou celular): cabeçalho em negrito com fundo,
   bordas nas 4 colunas, texto quebrando dentro da célula, "Diverge…" em vermelho, abas Resumo e
   Fora do PCM com cabeçalho; ao rolar, o cabeçalho fica parado. Se o Excel avisar "encontramos
   um problema", **anote** (e use a planilha mesmo assim: os dados estão lá).
5. "Restaurar um backup ›" (no fim) → escolher um backup → a tabela "Backup × Este celular" deixa
   claro o que vai mudar? O vermelho aparece onde o celular tem mais? "Restaurar este backup" numa
   linha só. **Cancelar** (não precisa restaurar).
6. **Toast**: importar/trocar o PCM com a lista rolada até o fim — o aviso "PCM importado…"
   aparece no topo e não cobre "Trocar o PCM"/"Tema".

Anote o que ficou pequeno, apagado ao sol, difícil de achar ou de tocar de luva (tela e tema).
