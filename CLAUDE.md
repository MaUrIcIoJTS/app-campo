# Levantamento PCM

App web (PWA) para levantar em campo as medidas de equipamentos de uma fábrica e comparar
com o **PCM** do cliente. Roda no navegador do celular, instala na tela inicial e funciona
**100% offline** depois do primeiro acesso. **Aparelho de campo: Android (Chrome)** — é onde
tudo é testado; iOS/Safari não é alvo de teste (evite só quebrar o básico nele).

Toda a documentação, a interface e as mensagens são em **português do Brasil**.

## Contexto de campo (leia antes de desenhar qualquer tela)

- Fábrica de cal: poeira, calor, **sol forte** na tela, equipamento rodando ao lado.
- O técnico usa **luva** e opera com uma mão; a atenção está no equipamento, não no celular.
- Celular comum, tela de **360 px**, às vezes fraco. **Sinal ruim ou nenhum.**
- A versão anterior (página web hospedada no claude.ai) falhou em campo: **perdeu medidas** e
  **a câmera não abria**. Este projeto existe para não repetir isso.
- Prazo: pronto e testado em campo na segunda-feira, 26/10/2026.

## Regras invioláveis

1. **Nunca perder dado do usuário.**
   - Toda alteração vai para o IndexedDB em até ~300 ms, sem botão "salvar"; gravação
     pendente é descarregada em `visibilitychange`/`pagehide`. Indicador "Salvo no aparelho".
   - Pedir `navigator.storage.persist()`.
   - Toda mudança de esquema do IndexedDB = nova versão + migração + **teste da migração**
     com dados da versão anterior. Migração nunca apaga store nem dado.
   - Reimportar o PCM nunca apaga medição/foto (dados do PCM e do usuário ficam separados).
   - Restaurar backup gera antes um backup automático do estado atual.
2. **Nada de rede em runtime.** Sem CDN, sem `fetch`, sem fontes externas. Tudo entra no
   build e no precache do service worker (inclusive o SheetJS, que carrega sob demanda; o zip
   de fotos é gerado por código próprio — o JSZip só é usado nos testes).
   O ESLint bloqueia `fetch`/`XMLHttpRequest` em `src/`.
3. **Nunca commitar dados reais do cliente.** O GitHub Pages é público.
   - `dados/` e planilhas (`.xls`, `.xlsx`, `.csv`…) ficam fora do git (`.gitignore` + hook + CI).
   - Testes usam só a fixture **fictícia** gerada por `scripts/gerar-fixture.ts`.
   - Não copie texto do PCM real (nomes de pessoas, TAGs, números de série, marcas, nome do
     cliente) para código, testes, docs, commits ou PRs. Exemplos usam TAGs como `XA-TC-01`.
4. **Toda tela testada em 360 px** de largura (E2E roda em 360 × 740).
5. **Textos da interface em português, curtos e diretos** ("Salvo no aparelho", "Tirar foto").

Outras regras de UI: alvos de toque ≥ 48 px; inputs ≥ 16 px (senão o iOS dá zoom);
medidas com `inputmode="decimal"` aceitando vírgula; tema claro e escuro de alto contraste;
câmera **só** com `<input type="file" accept="image/*">` dentro de `<label>` — nunca
`.click()` programático.

## Plano e estado atual

**Leia `docs/plano.md` no início de cada sessão**: fases, o que já está feito, o que já existe
pronto para a próxima fase e os critérios de aceite. Atualize-o ao terminar cada fase.

## Comandos

| Comando               | O que faz                                                         |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev`         | Servidor de desenvolvimento (sem service worker)                  |
| `npm run build`       | Typecheck + build de produção em `dist/`                          |
| `npm run preview`     | Serve o `dist/` em http://localhost:4173 (com service worker)     |
| `npm run typecheck`   | `tsc --noEmit`                                                    |
| `npm run lint`        | ESLint                                                            |
| `npm run format`      | Prettier em tudo                                                  |
| `npm test`            | Vitest (unitários, rápidos)                                       |
| `npm run test:e2e`    | Playwright: build + preview + testes em Chromium 360 px (offline) |
| `npm run pcm:resumo`  | Lê `dados/pcm.xls` e mostra equipamentos/itens/tipos (local)      |
| `npm run pcm:fixture` | Regera `tests/fixtures/pcm-ficticio.{xls,xlsx}`                   |
| `npm run icones`      | Regera os PNGs do PWA a partir de `public/favicon.svg`            |

## Estrutura

```
src/
  main.tsx, app.tsx, estilos.css, armazenamento.ts
  dominio/              regras puras, sem DOM (testadas em Node)
    tipos.ts            modelo do PCM importado
    numeros.ts          vírgula decimal, polegadas → mm, Δ
    rolete.ts           código de rolete A×B×C×D×E
    texto.ts            normalização (maiúsculas, sem acento)
    pcm/parser.ts       .xls/.xlsx → Pcm (SheetJS); deduz tambores
    pcm/tag.ts          TAG a partir da coluna A
    templates/          detectar.ts (tipo do item), registro.ts (campos), extratores.ts (valor PCM)
  db/                   (fase 1) IndexedDB com `idb`, esquema versionado + migrações
  ui/                   (fases 1–3) telas Preact; ui/desenhos/ = SVGs de referência
  exportar/             (fase 4) xlsx, backup json, zip de fotos, compartilhar
scripts/                resumo-pcm.ts, gerar-fixture.ts, gerar-icones.ts
tests/unit/             Vitest       tests/e2e/   Playwright       tests/fixtures/  só fictício
.claude/                settings.json (hooks + permissões), hooks/, skills/, agents/
dados/                  FORA DO GIT — pcm.xls real, só nesta máquina
```

## Modelo de dados

**PCM importado** (somente leitura; `src/dominio/tipos.ts`): `Pcm → AbaPcm → EquipamentoPcm
(TAG, nome) → ItemPcm (nome = col. B, especificacao = col. C, quantidade = col. D, tipo, linha)`.

- Ids estáveis: equipamento `<slug-da-aba>:<linha>`, item `<id-equip>:<linha>`; tambores
  deduzidos `<id-equip>:tambor-<n>` (`origem: 'deduzido'`, `linha: null`).
- A área de equipamentos começa 2 linhas após "EQUIPAMENTOS PARA INSPEÇÃO" e termina na linha
  "OBSERVAÇÕES". Coluna A só aparece na 1ª linha do bloco (mesclada); as seguintes herdam.

**IndexedDB** `levantamento-pcm` (planejado, fase 1 — `idb`):

| Store          | Chave           | Conteúdo                                                                                                           |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `importacoes`  | `id`            | nome do arquivo, data, **Blob do arquivo original** (para exportar igual)                                          |
| `equipamentos` | `id`            | `EquipamentoPcm` sem itens + `importacaoId`                                                                        |
| `itens`        | `id`            | `ItemPcm` + `equipamentoId`                                                                                        |
| `medicoes`     | `itemId`        | `valores {campoId: texto digitado}`, `conferencia {campoId: 'confere' \| 'diverge'}`, `observacao`, `atualizadaEm` |
| `notas`        | `equipamentoId` | observação do equipamento, `atualizadaEm`                                                                          |
| `fotos`        | `id`            | `alvoId` (item ou equipamento), `blob` JPEG, `criadaEm`, largura, altura                                           |
| `meta`         | `chave`         | versão do esquema, último backup, preferências                                                                     |

Valores medidos são guardados **como o texto digitado** ("38,1"); número só para o Δ.
Fotos: máx. ~1600 px no maior lado, JPEG ~0,8, como `Blob` (nunca base64 no banco).

## Decisões técnicas

- **Vite 8 + TypeScript 6 + Preact 10** (Preact 11 saiu há 3 semanas; TS 7 ainda não é
  suportado pelo typescript-eslint). Estado com hooks/signals simples, sem lib de estado.
- **vite-plugin-pwa** (Workbox, `generateSW`), `registerType: 'prompt'`: o app nunca recarrega
  sozinho no meio de uma medição; o usuário toca em "Atualizar". Precache de todo o shell.
- **`idb`** para IndexedDB: ~1 KB, promessas finas sobre a API nativa e `upgrade` explícito por
  versão — migrações ficam visíveis e testáveis com `fake-indexeddb`. Dexie (~30 KB) traria
  uma camada de esquema que não precisamos.
- **SheetJS 0.20.3 do CDN oficial** (`cdn.sheetjs.com`, no `package.json`): a versão do npm
  (0.18.5) está abandonada e tem vulnerabilidades conhecidas. É dependência de build, não de runtime.
- **GitHub Pages**: `BASE_PATH=/<repo>/` no workflow; local fica `/`.

## Convenções

- Nomes do domínio em português (`equipamento`, `medicao`, `foto`, `aba`, `item`); APIs de
  framework mantêm o nome original. Imports relativos com extensão `.ts`/`.tsx`.
- `dominio/` é puro (sem DOM, sem IndexedDB) e coberto por testes; a UI só orquestra.
- Todo bug encontrado em campo vira um teste antes da correção.
- Commits no estilo Conventional Commits, em português: `feat: importar PCM no celular`.
- Caso novo do PCM real → reproduzir com texto inventado em `scripts/gerar-fixture.ts`.

## Glossário do domínio

- **PCM** — Programa de Controle e Manutenção: planilha do cliente, uma aba por área da fábrica,
  com equipamentos, itens a inspecionar, especificação, quantidade, serviço e periodicidade.
- **TAG** — código do equipamento na planta, no fim do nome (formato `XA-TC-04`: área, tipo,
  número). Nem todo equipamento tem TAG (salas de painéis, iluminação, compressores).
- **Tapete** — a correia transportadora (a "lona"). No PCM: largura em polegadas (`26"`),
  **lonas** = camadas de tecido (`2 LONAS`, `2L`, `EP1000/4` = 4 lonas), coberturas
  superior × inferior em polegadas (`3/16 X 1/16`).
- **Tambor de tração** (acionamento, cabeça) — movido pelo redutor, puxa a correia.
  **Tambor de retorno** (cauda) — na outra ponta, em geral com o esticador. Pode haver tambores
  de desvio/encosto. O PCM não lista tambores: o app deduz pelos mancais (2 por tambor, mín. 2).
- **Rolete de carga** — roletes de cima, que sustentam a correia carregada (em geral 3 formando
  calha). **Rolete de retorno** — rolo único e longo embaixo, que sustenta a correia vazia.
  Emborrachado = com revestimento/anéis de borracha.
- **Código do rolete `A×B×C×D×E`** — comprimento do tubo × comprimento do eixo × Ø do tubo ×
  fresado × Ø do eixo. Vem nas duas ordens no fim (`…x14x20` / `…x20x14`): o menor é o fresado.
- **Fresado** — faces planas usinadas na ponta do eixo do rolete, que encaixam no suporte;
  mede-se a distância entre as faces.
- **LD / LE** — lado direito / lado esquerdo do equipamento, olhando no sentido do fluxo do
  material (convenção confirmada pelo usuário). **Centro a centro LD/LE**: distância entre os
  centros dos eixos dos tambores em cada lado; LD ≠ LE indica desalinhamento ou esticador desigual.
- **Mancal** — caixa que aloja o rolamento e apoia o eixo. **SNA** (ex.: `SNA 515`) = mancal
  bipartido de pedestal; `P209`/`F211` = mancal com rolamento de pedestal (P) ou flange (F).
- **Rolamento autocompensador de rolos** (`22215 K…`) — furo cônico (K), montado com bucha.
- **Bucha H / HE** — bucha cônica de fixação que prende o rolamento no eixo; **H** = série
  métrica, **HE** = série para eixo em polegadas.
- **Gornes / canais** — ranhuras da polia para correia em V: `2 GORNES B` = 2 canais perfil B
  ("BORNES" no PCM é erro de digitação).
- **Correia em V** — perfil + comprimento: `A50`, `B 50`, `C165` (estreitas: `SPA`, `SPB`…).
- **Redutor** — reduz a rotação: `1:30` = 30 voltas do motor para 1 na saída. Tipos comuns:
  coroa e rosca sem fim, engrenagens helicoidais.
- **Motorredutor** — motor e redutor num conjunto só (motor flangeado no redutor).
- **Eixo vazado** — redutor com eixo de saída oco: o eixo do tambor entra no redutor (chaveta
  ou disco de contração). O oposto é **eixo maciço** (ponta de eixo + acoplamento).
- **Acoplamento** — liga dois eixos (motor–redutor, redutor–tambor): borracha, dedo, rígido, cardan.
- **Chaveta** — peça que trava polia/acoplamento no eixo; anota-se largura × altura (ex.: 14 × 9).
- **Δ** — diferença **medido − PCM**, só quando os dois são números.
- **Confere / Diverge** — marcação manual do técnico **por campo** (decisão do usuário); o item
  diverge se qualquer campo divergir. O app não usa tolerância automática.
- **Rotor / roda** — rotor de exaustor, moinho, filtro ou roda do aeroseparador: Ø × largura
  (`1700X170`, `Ø1300X345L`), Ø do eixo, nº de pás. Grelhas e mangas ficam no genérico.

## Automação do Claude Code (`.claude/`)

- **Hooks** (`settings.json` → `hooks/`):
  - `PostToolUse` Edit/Write → `formatar.sh`: Prettier + `eslint --fix` só no arquivo editado;
    erro de lint que sobra volta para o Claude.
  - `PreToolUse` Bash → `proteger-git.sh`: bloqueia `git add`/`commit` com `dados/` ou planilhas
    fora de `tests/fixtures/` (inclusive `-f`, `-A`, `commit -a`, índice) e `git push` forçado.
  - `Stop` → `verificar-ao-parar.sh`: `typecheck` + testes unitários se o código mudou.
- **Permissões**: npm/npx do projeto e git (menos push) liberados; `git push`, `npm install <pacote>`
  e comandos destrutivos pedem confirmação; push forçado negado.
- **Skills**: `importar-pcm`, `novo-tipo-de-item`, `testar-offline`, `publicar`, `exportar-pcm`.
- **Subagente**: `revisor-de-campo` — revise toda tela nova com ele antes de dar como pronta.
