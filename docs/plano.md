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

| Fase                                            | Situação                                                      |
| ----------------------------------------------- | ------------------------------------------------------------- |
| 0. Repositório, CI, Pages                       | ✅ feito                                                      |
| 1. Banco, importação, lista, ficha (só leitura) | ✅ feito e **validado no celular em 24/10** (critérios 1 e 2) |
| 2. Ficha com medição                            | ✅ feito — **aguardando teste no celular** (roteiro abaixo)   |
| 3. Fotos e desenhos SVG                         | ⏳ próxima                                                    |
| 4. Exportar, backup, restaurar, compartilhar    | a fazer                                                       |
| 5. Ensaio geral (critérios 1–5 no Android)      | a fazer                                                       |

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
- Desenhos SVG (skill `novo-tipo-de-item`, passo 6): tambor, rolete (A–E), vista superior
  (LD/LE), acionamento, mancal, polia.
- E2E: `setInputFiles` com JPEG grande → comprimido → recarregar → foto continua.

## Fase 4 — exportar e backup

Regras completas na skill `exportar-pcm` (colunas, nomes de arquivo, aba "Fora do PCM",
aba "Resumo", backup JSON com fotos em base64, restauração com backup automático antes,
`.zip` de fotos, Web Share com o arquivo gerado ANTES do toque, download como alternativa).

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
