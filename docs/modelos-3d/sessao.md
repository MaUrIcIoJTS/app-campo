# Sessão dedicada: modelos 3D e pranchas no AutoCAD a partir do levantamento de campo

## PASSO 0 — resultados primeiro

Se eu trouxer um resultado (desenho errado, medida estranha, AutoCAD travando), trate ANTES de
tudo. Erro de desenho vira teste antes da correção; trabalho meu perdido em `dados\trabalho\` é
prioridade máxima. Me mostre o diagnóstico e o plano da correção antes de codar.

## Contexto

Faço levantamento de campo numa fábrica de cal com o app **Levantamento PCM** (PWA offline no
celular; código em https://github.com/MaUrIcIoJTS/app-campo). O app guarda, por equipamento do
PCM do cliente, as medidas das peças (tambores, roletes, tapete, mancais, motor, redutor…), as
**medidas externas do corpo num croqui com cotas por letra** (9 formatos: aeroseparador, silo,
peneira, filtro de mangas, moinho/britador, exaustor, rosca, elevador, válvula), fotos e notas.
Tudo sai num **backup `.json`**.

O cliente agora quer, **para cada equipamento medido, um desenho 3D no AutoCAD e a prancha 2D,
um arquivo por equipamento**. Ainda não tem padrão (layers, carimbo): começamos com um padrão
nosso, simples e fácil de trocar, e evoluímos conforme o cliente pedir.

**Este projeto gera o primeiro modelo de cada equipamento já nas medidas do levantamento; eu
termino à mão no AutoCAD.** A arquitetura completa está em
`C:\projetos\app-campo\docs\modelos-3d\arquitetura.md`. Leia inteira antes de começar.

## A máquina (pesa em todas as decisões)

- Notebook Windows, **AutoCAD 2027 completo**, **4 GB de RAM**: abaixo do mínimo que a Autodesk
  lista. Geração em lote **sem a interface** (`accoreconsole.exe`), um equipamento por processo;
  nada de Playwright, navegador de teste ou dependência pesada; nunca abrir o backup inteiro na
  memória (leitura linha a linha).
- Claude Code nativo no Windows (sem WSL), com Git for Windows, Node.js LTS e GitHub CLI.
- Pastas: este projeto em `C:\projetos\modelos-3d`; o app em `C:\projetos\app-campo` (clone só de
  leitura). Abra a sessão com `claude --add-dir C:\projetos\app-campo` para poder ler o app.

## O que eu já fiz antes de abrir a sessão

1. Instalei Git for Windows, Node.js LTS, GitHub CLI e o Claude Code.
2. `git clone https://github.com/MaUrIcIoJTS/app-campo C:\projetos\app-campo`
3. Criei `C:\projetos\modelos-3d\dados\backups\` e copiei para lá o backup do celular.

Se faltar algo, me diga o comando e eu rodo (com `!` na frente, quando for interativo, como
`! gh auth login`).

## O que existe no app (para não redescobrir)

- **Formato do backup** (versão 1): skill `exportar-pcm` do app e `src/exportar/backup.ts`. As
  listas têm **um registro por linha**; as fotos vêm por último, em base64.
- **Campos de cada tipo de item** (ids, unidades, letras do croqui):
  `src/dominio/templates/registro.ts`. Croqui: `src/dominio/croqui.ts` e `docs/croqui.md`.
- **Valores são o texto digitado**: `"38,1"`, `"≈ 1900"` (estimado), `"sem acesso"`,
  `<campo>Perimetro` (Ø = perímetro ÷ π), conferência `naoTem` (a peça não existe).
- Funções puras que valem copiar (com origem e commit no topo): `src/dominio/numeros.ts`
  (vírgula, polegadas), `texto.ts` (normalização), `rolete.ts` (código A×B×C×D×E).
- Glossário do domínio (tapete, tambor de tração/retorno, roletes de carga/retorno, LD/LE,
  mancal SNA, redutor…): `CLAUDE.md` do app.

## O PCM real em números (84 equipamentos em 6 abas)

| Grupo                                                                                                        | Equip. | Base do 3D                                                                                |
| ------------------------------------------------------------------------------------------------------------ | -----: | ----------------------------------------------------------------------------------------- |
| Com croqui (9 formatos)                                                                                      |     39 | cotas A–F da guia Exterior + peças                                                        |
| Transportadoras de correia                                                                                   |     16 | tambores (Ø, face, eixo), roletes (código e quantidade), tapete, centro a centro, mancais |
| Máquinas sem formato (skip, gaveta, gasogênio, ventilador de ar de combustão, calha vibratória, compressor…) |     17 | só as peças; corpo à mão ou genérico                                                      |
| Sem desenho de máquina (salas de painéis, transformadores, zonas do forno, iluminação, galpão)               |     12 | provavelmente fora (confirmar com o cliente)                                              |

No backup de 27/10 há uma transportadora medida por completo (2 tambores, 3 tipos de rolete,
tapete com centro a centro LD/LE, mancais), outra parcial e um croqui de peneira com 2 das 5
cotas, ambas estimadas. Nesse backup, o centro a centro foi digitado **em metros** (`9,80`) num
campo em mm: o leitor precisa reconhecer isso e avisar.

## Etapa 0 — montar o projeto

1. Confira o ambiente e me mostre: versões (Windows, Node, Git, gh, Claude Code), memória total
   e livre, caminho do `accoreconsole.exe` e idioma do AutoCAD.
2. Me mostre um plano curto da montagem e espere meu ok.
3. Monte a estrutura da arquitetura: `CLAUDE.md` (a partir do rascunho), `docs/` (copie a
   arquitetura para `docs/arquitetura.md`; crie `plano.md`, `autocad.md`, `decisoes.md`),
   `package.json` mínimo, TypeScript, ESLint, Prettier, Vitest (um processo), `.gitignore` com
   `dados/`, e `.claude/` (settings, os 3 hooks, as 5 skills, o subagente `revisor-de-prancha`).
4. `scripts/gerar-backup-ficticio.ts`: backup v1 com TAGs inventadas (`XA-…`): uma transportadora
   completa, um silo, um aeroseparador, uma peneira com "≈" e "sem acesso", um Ø pelo perímetro e
   um centro a centro em metros.
5. Prove que os hooks funcionam: commit de um arquivo de `dados/` bloqueado, `.lsp` com
   parêntese faltando avisado, Stop rodando os testes.
6. `git init` e primeiro commit. **Repositório privado no GitHub só depois da minha confirmação.**

## Etapa 1 — prova da cadeia e análise (pare no fim)

1. **O AutoCAD 2027 em lote.** Responda com testes reais e registre em `docs/autocad.md`:
   - O `accoreconsole` abre o template e carrega `lisp\pcm3d.lsp` sem pergunta
     (`SECURELOAD`/`TRUSTEDPATHS`)?
   - Cria sólidos com `command`: `_.CYLINDER`, `_.CONE` (tronco), `_.BOX`, `_.EXTRUDE`,
     `_.REVOLVE`, `_.LOFT`, `_.UNION`, `_.SUBTRACT`? E `vla-*`, funciona?
   - `_.MASSPROP` grava `.mpr`? `-PLOT` gera PDF (`DWG To PDF.pc3`) e PNG do layout?
   - `_.VIEWBASE` funciona no `accoreconsole`? E no `acad.exe /b` com a interface?
   - Tempo e pico de memória por equipamento, nos dois jeitos.
2. **Inventário do backup real.** O real fica em `dados\`; no repositório entram só contagens.
   - Por grupo e por formato: cotas medidas, estimadas, sem acesso e faltando.
   - Os avisos de interpretação.
   - O que o 3D precisa e o app não mede hoje: lado do acionamento (LD/LE), altura do chão,
     inclinação da transportadora, posição das bocas, espaçamento dos roletes, estação de carga
     plana ou em calha. Escreva `docs\lacunas-do-app.md` com a proposta de campos novos. Eu levo
     para a sessão do app; **não mexa no app daqui**.
3. **Ponta a ponta, dois equipamentos.** Cada um sai em DWG, com o 3D nas layers, a prancha A3 e o
   PDF/PNG, passa pelo `npm run conferir` e pelo `revisor-de-prancha`.
   - **A transportadora medida por completo.** O real fica em `dados\`; nos testes, use a
     equivalente fictícia.
     - Tambores na distância do centro a centro (LD ≠ LE gera aviso), tapete fechado em volta.
     - Roletes de carga e de retorno: quantidade medida, espaçamento estimado.
     - Mancais pelo código, estrutura estimada.
     - Confira o comprimento do tapete contra 2 × C + π × (D1 + D2) / 2.
   - **Um silo fictício** (ainda não há silo medido), para exercitar o caminho do croqui.
   - Me mande o PNG da prancha e uma vista isométrica de cada um.
4. **Decisões que dependem de mim**, cada uma com a sua recomendação:
   - `VIEWBASE` ou vistas desenhadas pelo gerador;
   - como posicionar o acionamento enquanto o app não tiver o campo;
   - o que fazer com as 17 máquinas sem formato e os 12 sem desenho;
   - o nível de detalhe da estrutura da transportadora.

**Pare e espere minha aprovação.**

## Etapas seguintes (depois da aprovação, uma de cada vez)

2. Os 9 formatos do croqui e a ficha de modelagem (HTML com medidas e fotos de cada equipamento).
3. Transportadoras completas e peças do acionamento (motor pela carcaça IEC, redutor, polias,
   acoplamento), com catálogos públicos citados.
4. Padrão do cliente (layers, carimbo, nomes de arquivo), quando ele definir.

## Critérios de aceite

1. Do backup copiado ao DWG + PDF de um equipamento, sem abrir a interface do AutoCAD.
2. Todo número da prancha bate com o levantamento. Estimadas e interpretadas estão marcadas.
   O `conferir` não acha divergência entre o AutoCAD e o esperado.
3. Regenerar nunca sobrescreve `dados\trabalho\` nem `dados\entrega\`.
4. O lote de todos os equipamentos com formato roda no notebook de 4 GB sem travar.
5. Nenhum dado real no git (hook e `.gitignore`; CI se houver).

## Regras

- **Nunca inventar medida sem marcar** (layer `3D-ESTIMADO` e lista na prancha).
- **Nunca sobrescrever trabalho meu** (`dados\trabalho\`, `dados\entrega\`).
- **Nenhum dado real do cliente** em código, testes, docs ou commits: nenhum nome, TAG ou marca,
  nem o nome do cliente. Exemplos usam `XA-TC-01`. O cliente e o responsável do carimbo vêm de
  `dados\projeto.json`.
- **O app de campo é só leitura.**
- `git push` só com a minha confirmação; nunca forçado.

## Forma de trabalhar

Tudo em português do Brasil. Antes de codar, mostre um plano curto e espere minha aprovação. Ao
fim de cada etapa:

1. rode typecheck, lint, os testes e a skill `conferir-desenho`;
2. passe as pranchas novas pelo `revisor-de-prancha`;
3. atualize `docs/plano.md`;
4. me mostre o resultado (PNG);
5. faça o commit, sem push.
