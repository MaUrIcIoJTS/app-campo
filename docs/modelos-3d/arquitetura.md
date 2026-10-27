# Modelos 3D — arquitetura do projeto

Projeto novo, separado do app de campo: lê o **backup `.json` do app Levantamento PCM** e gera, para
cada equipamento medido, **um DWG com o modelo 3D e a prancha 2D** (A3) no AutoCAD 2027. O
técnico termina o desenho à mão no AutoCAD; o projeto faz a parte repetitiva e garante que as
medidas de campo entram certas.

Este arquivo é a semente do projeto: a sessão do Claude Code no notebook monta a estrutura a partir
dele e copia este texto para `docs/arquitetura.md` do projeto novo.

## Máquina

- Notebook **Windows**, **AutoCAD 2027** (completo; o LT não faz sólidos 3D), **4 GB de RAM**.
- 4 GB está **abaixo do mínimo que a Autodesk lista para o AutoCAD** (8 GB; alguns guias falam em
  16 GB para o 2027). Toda a arquitetura economiza memória:
  - Claude Code **nativo no Windows** (sem WSL: a máquina virtual do WSL reserva memória);
  - geração em **lote, sem a interface do AutoCAD** (`accoreconsole.exe`), **um equipamento por
    processo**: a memória volta ao Windows entre um e outro;
  - AutoCAD com interface só para olhar e terminar o desenho — de preferência com o Claude Code
    parado (sem testes rodando);
  - nada de navegador de testes (Playwright), servidor de desenvolvimento ou dependência pesada;
  - sólidos simples (envelope, sem espessura de chapa, sem filetes, sem roscas).
- Se der para ampliar a memória para 8–16 GB, tudo isso continua valendo e fica mais rápido.

### Programas

| Programa                                                                    | Para quê                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| Claude Code (instalador nativo, `irm https://claude.ai/install.ps1 \| iex`) | a sessão de trabalho                                |
| Git for Windows                                                             | git e o Git Bash que o Claude Code usa como shell   |
| Node.js LTS (22 ou mais novo)                                               | gerador, testes, hooks                              |
| GitHub CLI (`gh`)                                                           | repositório privado no GitHub (login por HTTPS)     |
| AutoCAD 2027                                                                | `accoreconsole.exe` (lote) e `acad.exe` (interface) |

Pastas: `C:\projetos\modelos-3d` (este projeto) e `C:\projetos\app-campo` (clone **só de leitura**
do app, para consultar o formato do backup e copiar funções puras). Fora de pasta sincronizada pelo
OneDrive (sincronização no meio do lote trava arquivo e gasta memória).

## Fluxo

```
celular ──backup .json──► dados\backups\
                              │  npm run importar      (leitura em fluxo, linha a linha)
                              ▼
                  dados\levantamento\<TAG>.json  +  dados\fotos\<TAG>\*.jpg  +  avisos
                              │  npm run gerar         (TypeScript puro, testado)
                              ▼
                  dados\saida\<TAG>\roteiro.scr  +  esperado.json  +  ficha.html
                              │  npm run autocad       (accoreconsole.exe, 1 processo por TAG)
                              ▼
                  dados\saida\<TAG>\<TAG>.dwg  +  <TAG>.pdf  +  <TAG>.png  +  massprop.mpr + log
                              │  npm run conferir      (medidas do AutoCAD × esperado)
                              ▼
                  relatório: o que confere, o que é estimado, o que falta medir
                              │  (técnico copia para dados\trabalho\ e termina no AutoCAD)
                              ▼
                  dados\entrega\<TAG>.dwg + <TAG>.pdf   (o que vai para o cliente)
```

- **Leitura em fluxo.** Um dia de campo dá um backup de 200–300 MB (fotos em base64). Nunca
  `JSON.parse` do arquivo inteiro: o app grava **um registro por linha** nas listas
  (`equipamentos`, `itens`, `medicoes`, `notas`, `fotos`), então o importador lê linha a linha e
  grava cada foto em disco na hora (uma por vez na memória). Formato completo: skill
  `exportar-pcm` do app (`..\app-campo\.claude\skills\exportar-pcm\SKILL.md`) e
  `src/exportar/backup.ts` / `lerBackup.ts`.
- **Gerador fora do AutoCAD.** Toda a lógica (medidas → geometria → vistas → cotas → carimbo) é
  TypeScript puro e testado no Vitest, sem AutoCAD. O AutoCAD só executa um roteiro já pronto,
  com números literais. AutoLISP não tem leitor de JSON, e depurar lá é caro.
- **Conferência pelo próprio AutoCAD.** O roteiro termina com `MASSPROP` gravando em arquivo
  (volume e caixa envolvente de cada sólido); `npm run conferir` compara com o `esperado.json`
  que o gerador calculou. Também plota a prancha em PDF e PNG: o Claude lê o PNG e confere o
  desenho visualmente.

## Estrutura de pastas

```
modelos-3d/
  CLAUDE.md                regras e contexto (rascunho abaixo)
  README.md                como instalar e rodar, para gente
  package.json             scripts: importar, gerar, autocad, conferir, test, typecheck, lint, format
  tsconfig.json  eslint.config.js  .prettierrc.json  .editorconfig  .gitignore
  src/
    leitura/               backup .json → levantamento normalizado (em fluxo)
      backup.ts            linhas → registros; fotos direto para disco
      contrato.ts          ids dos campos do app que o projeto lê, por tipo de item (ver "Contrato")
    dominio/               PURO (sem disco, sem AutoCAD), coberto por testes
      copiado-do-app/      numeros.ts, texto.ts, rolete.ts — cópias com origem e commit no topo
      medidas.ts           texto digitado → Medida (mm, estado, aviso)
      modelo.ts            tipos: Equipamento, Peca, Medida, Solido, Vista, Cota, Prancha
      formatos/            um arquivo por formato: transportadora.ts, cilindro-cone.ts (silo e
                           aeroseparador), peneira.ts, filtro.ts, caixa.ts, voluta.ts, rosca.ts,
                           elevador.ts, valvula.ts, generico.ts — cada um: Equipamento → Modelo
      pecas/               motor.ts, mancal.ts, tambor.ts, rolete.ts, polia.ts, redutor.ts…
      catalogos/           tabelas públicas (carcaças IEC, mancais SNA/SNL…) com a fonte no topo
      prancha.ts           vistas, escala, cotas, tabela de medidas, notas, carimbo
    cad/
      lisp.ts              Modelo → texto do roteiro (.scr + chamadas da biblioteca LISP)
      layers.ts            nomes e cores das layers num lugar só (padrão do cliente entra aqui)
    cli/                   importar.ts, gerar.ts, autocad.ts, conferir.ts (finos: só orquestram)
  lisp/
    pcm3d.lsp              biblioteca: (pcm:cilindro …) (pcm:tronco-cone …) (pcm:caixa …)
                           (pcm:tremonha …) (pcm:layer …) (pcm:carimbo …) — sem lógica de medida
  modelos/
    prancha-a3.dwt         template: unidades mm, layers, estilos de texto e cota, carimbo genérico
  scripts/
    gerar-backup-ficticio.ts   backup no formato v1 com TAGs inventadas (XA-…)
  tests/
    unit/                  Vitest: leitura, medidas, formatos, prancha, roteiro (snapshot)
    fixtures/              backup-ficticio.json (pequeno, sem foto real)
  docs/
    arquitetura.md         este arquivo
    plano.md               etapas, o que está feito, critérios de aceite
    autocad.md             o que funciona no accoreconsole 2027 e o que não (medido na Etapa 1)
    decisoes.md            decisões com data e motivo
  dados/                   FORA DO GIT
    projeto.json           nome do cliente, responsável, obra (vai no carimbo; nunca no git)
    backups/  levantamento/  fotos/  saida/  trabalho/  entrega/
    proibidos.txt          TAGs e nomes reais (gerado pelo importador; usado pelo hook do git)
  .claude/
    settings.json  hooks/  skills/  agents/
```

## Contrato com o app de campo

O app guarda o **texto digitado** ("38,1", "≈ 1900", "sem acesso"). O projeto interpreta:

| No backup                                     | Vira                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `"38,1"`                                      | 38,1 mm, `medida`                                                               |
| `"≈ 1900"`                                    | 1900 mm, `estimada` (vai para a layer de estimado)                              |
| `"sem acesso"` (qualquer caixa/acento)        | sem número, `sem-acesso` (usa valor padrão e marca)                             |
| campo ausente                                 | `falta`                                                                         |
| `<campo>Perimetro` (ex.: `diametroPerimetro`) | Ø = perímetro ÷ π, `medida` (o app já mostra assim)                             |
| conferência `naoTem`                          | a peça não existe neste equipamento                                             |
| valor fora da faixa plausível do campo        | `interpretada` + aviso (ex.: centro a centro `9,80` num campo em mm → 9 800 mm) |

- Ids dos campos: `..\app-campo\src\dominio\templates\registro.ts`. Croquis: `corpo-*` com as
  letras A–F (ex.: silo `diametro` A, `alturaCilindro` B, `alturaCone` C, `saida` D, `bocaCarga`
  E). Transportadora: itens `tapete` (`largura`, `espessura`, `comprimento` em **m**, `centroLd`
  e `centroLe` em mm), `tambor` (`funcao`, `diametro`, `comprimento` = face, `eixoMancal`,
  `comprimentoEixo`, `mancal`), `rolete` (`a`…`e` = código A×B×C×D×E, `quantidade`).
- O app pode mudar: `src/leitura/contrato.ts` lista **só** os ids que o projeto usa, e a skill
  `sincronizar-app` compara com o clone do app. Campo que sumiu ou mudou de unidade quebra um
  teste, nunca um desenho em silêncio.
- **Faixas plausíveis** por campo (ex.: centro a centro 500–200 000 mm; Ø de tambor 100–2 000 mm)
  ficam no contrato. Fora da faixa: interpreta se for óbvio (unidade trocada) e **sempre avisa**.
- Observações livres do técnico vão para a ficha e para as notas da prancha como texto; nunca são
  interpretadas como medida.

## Modelo 3D e prancha — convenções

- **Unidade:** 1 unidade = 1 mm (`INSUNITS` 4).
- **Eixos:** Z para cima; X no sentido do fluxo do material; Y para a esquerda. Logo **LE = +Y,
  LD = −Y** (LD/LE olhando no sentido do fluxo, como no app).
- **Origem:** centro da base do corpo; na transportadora, eixo do tambor de retorno no chão do
  desenho (Z da linha de centro = altura padrão, marcada como estimada até existir campo de altura).
- **Sólidos cheios** (envelope do equipamento), um por peça, cada peça na sua layer.
- **Layers** (em `src/cad/layers.ts`; quando o cliente tiver padrão, muda só lá):
  `3D-CORPO`, `3D-BOCAS`, `3D-TAMBORES`, `3D-ROLETES`, `3D-CORREIA`, `3D-MANCAIS`,
  `3D-ACIONAMENTO`, `3D-ESTRUTURA`, `3D-ESTIMADO` (magenta), `2D-VISTAS`, `2D-OCULTAS`,
  `2D-CENTRO`, `2D-COTAS`, `2D-TEXTO`, `2D-CARIMBO`.
- **Nunca inventar medida sem marcar:** peça com qualquer medida estimada, padrão ou de catálogo vai
  para `3D-ESTIMADO` e entra na lista "Medidas estimadas" da prancha.
- **Prancha A3 paisagem**, 1º diedro (ABNT): vista frontal, lateral e superior em escala normalizada
  (1:5, 1:10, 1:20, 1:25, 1:50, 1:100 — a maior que cabe), isométrica sem escala, cotas principais
  com as letras do croqui, tabela de componentes (medido × PCM), notas (observações, estimadas,
  sem acesso) e carimbo genérico: equipamento, TAG, área (aba do PCM), data do levantamento,
  escala, folha, revisão, "Medidas de campo — conferir antes de fabricar". Cliente e responsável
  vêm de `dados\projeto.json`.
- **Vistas 2D:** a Etapa 1 decide entre `VIEWBASE` (vistas associativas: acompanham o 3D quando o
  técnico edita) e vistas desenhadas pelo gerador (funcionam no lote e são testáveis sem
  AutoCAD). Critério: o que funcionar no `accoreconsole` e couber em 4 GB.
- **Arquivos:** `<TAG>.dwg` (sem TAG: `<aba>-<nome-em-slug>.dwg`). O gerador só escreve em
  `dados\saida\`. `dados\trabalho\` é do técnico: **o gerador nunca sobrescreve** um arquivo lá; se
  precisar regenerar, grava ao lado com sufixo de data e avisa.

### AutoLISP / roteiro — pegadinhas que valem para todo o código

- Comandos sempre com `_.` (`_.CYLINDER`, `_.-LAYER`, `_.SAVEAS`): funcionam no AutoCAD em
  português e ignoram comandos redefinidos.
- No começo do roteiro: `OSMODE 0` (o snap muda coordenadas), `CMDECHO 0`, `FILEDIA 0`,
  `CMDDIA 0`, UCS universal. No fim: salvar, fechar.
- `vla-*`/`vlax-*` (ActiveX) **não** funcionam no `accoreconsole` (relatos de fórum; a Etapa 1
  confirma). O que roda em lote usa `command` e `entmake`.
- `SECURELOAD`: carregar `.lsp` de pasta não confiável abre uma pergunta e trava o lote. Pôr
  `C:\projetos\modelos-3d\lisp` em `TRUSTEDPATHS` (a Etapa 1 acha o jeito que funciona no
  `accoreconsole`).
- Números no roteiro com **ponto** decimal, sempre; vírgula só nos textos da prancha.

## Testes

- **Unitários (Vitest, Node, um processo só por causa da memória):** leitura em fluxo do backup
  fictício (inclusive arquivo grande gerado na hora, só com memória limitada); `medidas.ts` (≈, sem
  acesso, perímetro, unidade trocada); cada formato (dimensões, caixa envolvente e volume
  calculados à parte); prancha (escala escolhida, cotas presentes); roteiro gerado (snapshot).
- **No AutoCAD (local, `npm run test:autocad`):** gera os equipamentos do backup fictício, roda o
  `accoreconsole`, e o `massprop.mpr` de cada sólido confere com o `esperado.json` (tolerância
  0,5 %). Não roda em CI (lá não tem AutoCAD).
- **Bug de desenho vira teste antes da correção** (como no app).
- CI no GitHub Actions (opcional): typecheck, lint, formatação e unitários; e a mesma barreira
  do app contra dados reais (`dados/`, `.dwg`, `.json` fora de `tests/fixtures/`).

## Rascunho do `CLAUDE.md`

```markdown
# Modelos 3D

Gera, a partir do backup do app Levantamento PCM, um DWG por equipamento com o modelo 3D e a
prancha 2D A3, no AutoCAD 2027. O técnico termina o desenho no AutoCAD. Tudo em português do
Brasil. Arquitetura: `docs/arquitetura.md`. **Leia `docs/plano.md` no início de cada sessão.**

## Máquina (leia antes de rodar qualquer coisa pesada)

Notebook Windows com 4 GB de RAM (abaixo do mínimo do AutoCAD). Lote sem interface
(`accoreconsole`), um equipamento por processo. Nada de Playwright, navegador de teste, servidor
de desenvolvimento ou dependência pesada. Nunca abra o backup com Read: use `npm run importar`.

## Regras invioláveis

1. **Nunca perder trabalho do técnico:** o gerador nunca sobrescreve nada em `dados/trabalho/` nem
   em `dados/entrega/`.
2. **Nunca inventar medida sem marcar:** estimada, padrão, de catálogo ou interpretada vai para a
   layer `3D-ESTIMADO` e para a lista da prancha. Valor fora da faixa sempre gera aviso.
3. **Nunca commitar dados reais do cliente:** `dados/` fora do git (`.gitignore` + hook + CI). Nada
   de TAG, nome, marca ou nome do cliente em código, testes, docs ou commits; exemplos usam TAGs
   inventadas (`XA-TC-01`). O hook bloqueia commit que contenha algo de `dados/proibidos.txt`.
4. **O app de campo é só leitura:** `..\app-campo` serve para consulta e cópia de funções puras.
   Mudança no app vira proposta para a sessão do app, nunca edição daqui.
5. `git push` sempre com confirmação; nunca forçado.

## Comandos

| `npm run importar -- dados\backups\<arquivo>.json` | backup → dados\levantamento + fotos + avisos |
| `npm run gerar -- [--tag XA-TC-01]` | roteiro, esperado e ficha por equipamento |
| `npm run autocad -- [--tag XA-TC-01]` | accoreconsole: DWG, PDF, PNG, massprop |
| `npm run conferir -- [--tag XA-TC-01]` | AutoCAD × esperado; estimadas; faltas |
| `npm test` / `npm run test:autocad` | unitários / prova no AutoCAD (local) |
| `npm run typecheck` / `lint` / `format` | |

## Convenções

Domínio em português; `src/dominio/` puro e testado; `src/cli/` só orquestra. Imports relativos
com extensão. Conventional Commits em português. Mudou o modelo ou a prancha → rode a skill
`conferir-desenho` e o subagente `revisor-de-prancha` antes de dar como pronto.
(+ convenções do modelo e pegadinhas do AutoLISP: copiar da arquitetura)

## Glossário

Copiar do `..\app-campo\CLAUDE.md` o que vale aqui (PCM, TAG, tapete, tambores, roletes e
código A×B×C×D×E, LD/LE, mancal SNA, redutor, croqui) e acrescentar: prancha, carimbo,
1º diedro, envelope, accoreconsole.
```

## Automação do Claude Code (`.claude/`)

### `settings.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Read(./**)",
      "Bash(npm run *)",
      "Bash(npm test)",
      "Bash(npm test *)",
      "Bash(npm ci)",
      "Bash(npx tsc *)",
      "Bash(npx vitest *)",
      "Bash(npx eslint *)",
      "Bash(npx prettier *)",
      "Bash(npx tsx *)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git show *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git switch *)",
      "Bash(git branch *)",
      "PowerShell(npm run *)",
      "PowerShell(npm test *)"
    ],
    "ask": [
      "Bash(git push *)",
      "PowerShell(git push *)",
      "Bash(npm install *)",
      "PowerShell(npm install *)",
      "Bash(git reset --hard *)",
      "Bash(git clean *)"
    ],
    "deny": [
      "Bash(git push --force *)",
      "Bash(git push -f *)",
      "Bash(git push --force-with-lease *)",
      "Read(./dados/backups/**)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/proteger-git.mjs"],
            "timeout": 30
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/conferir-arquivo.mjs"],
            "timeout": 60
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/verificar-ao-parar.mjs"],
            "timeout": 180,
            "statusMessage": "Conferindo tipos e testes…"
          }
        ]
      }
    ]
  }
}
```

- `Read(./dados/backups/**)` negado: o backup tem centenas de MB e encheria o contexto.
- Hooks no **formato exec** (`command: "node"` + `args`): rodam o Node direto, sem depender do Git
  Bash nem do PowerShell. Dentro dos hooks, chame Prettier/ESLint/Vitest pelo `.js` deles com
  `process.execPath` (os `.cmd` de `node_modules\.bin` não abrem sem shell no Windows).

### Hooks (`.claude/hooks/*.mjs`)

| Hook                     | Quando                   | O que faz                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proteger-git.mjs`       | antes de Bash/PowerShell | bloqueia `git add`/`commit` com `dados/`, `.dwg`, `.dxf`, `.bak`, `.pdf`, `.jpg`, backup `.json` fora de `tests/fixtures/` (inclusive `-A`, `-f`, `commit -a`); bloqueia commit cujo diff contenha algo de `dados/proibidos.txt`; bloqueia push forçado |
| `conferir-arquivo.mjs`   | depois de Edit/Write     | `.ts`/`.mjs`/`.json`/`.md`: Prettier + `eslint --fix` só no arquivo; `.lsp`: parênteses e aspas balanceados, comandos com `_.`, sem `vla-`/`vlax-` nas funções do lote. Erro que sobra volta para o Claude (saída 2)                                    |
| `verificar-ao-parar.mjs` | ao terminar a resposta   | se `src/`, `tests/` ou `lisp/` mudaram: typecheck + unitários (um processo); falhou → volta para o Claude                                                                                                                                               |

### Skills (`.claude/skills/<nome>/SKILL.md`)

| Skill              | Use quando                                                    | Conteúdo                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gerar-desenhos`   | gerar ou regenerar DWG/PDF de um equipamento ou de todos      | o fluxo inteiro (importar → gerar → autocad → conferir), onde cada arquivo fica, a regra de não sobrescrever `trabalho/` e `entrega/`, como ler o relatório                     |
| `novo-formato`     | criar ou mudar um formato (corpo, transportadora) ou uma peça | contrato com o app, primitivas em TS, função LISP, vistas e cotas, catálogo com fonte, testes (dimensão, volume, snapshot), fixture fictícia                                    |
| `autocad-lote`     | rodar ou depurar o `accoreconsole`/`acad.exe /b`              | linha de comando (`/i`, `/s`, `/l`), variáveis do começo do roteiro, `SECURELOAD`/`TRUSTEDPATHS`, log, tempo limite, memória, o que não funciona no lote (de `docs/autocad.md`) |
| `conferir-desenho` | depois de gerar, antes de dar como pronto                     | `massprop` × esperado, ler o PNG da prancha, lista de estimadas/sem acesso/faltas, quando chamar o `revisor-de-prancha`                                                         |
| `sincronizar-app`  | o app de campo mudou (pull no clone)                          | comparar `contrato.ts` e `copiado-do-app/` com o clone, atualizar cópias com o commit de origem, rodar os testes; mudanças necessárias no app viram proposta                    |

### Subagente (`.claude/agents/revisor-de-prancha.md`)

Projetista mecânico que faz levantamento de campo e conhece desenho técnico ABNT. **Revisa, não
edita.** Lê o PNG/PDF da prancha, o `esperado.json`, o relatório do `conferir` e o levantamento
do equipamento, e devolve uma lista priorizada:

- vistas no 1º diedro, alinhadas, escala normalizada e coerente com o carimbo;
- cotas principais presentes, legíveis em A3 impresso, sem sobreposição, com as letras do croqui;
- todo número da prancha bate com o levantamento (unidade, vírgula, estimado marcado);
- estimadas, sem acesso e faltas listadas; nada inventado sem marca;
- layers e cores conforme `layers.ts`; carimbo completo; texto em português;
- o que o técnico ainda precisa desenhar à mão, para não esquecer.

Ferramentas: `Read, Grep, Glob, Bash` (Bash só para rodar `npm run conferir`).

## O que fica para o cliente decidir (e onde muda)

| Decisão do cliente         | Muda em                                             |
| -------------------------- | --------------------------------------------------- |
| padrão de layers e cores   | `src/cad/layers.ts`                                 |
| carimbo e formato da folha | `modelos/prancha-a3.dwt` + `src/dominio/prancha.ts` |
| nível de detalhe           | `src/dominio/formatos/` e `pecas/`                  |
| nome dos arquivos          | `src/cli/gerar.ts`                                  |
