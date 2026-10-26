# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA instalada na tela inicial; o aparelho de campo e de teste é Android (Chrome). iOS/Safari não é
alvo de teste (só não quebrar o básico).

## Users

Hoje: um técnico de manutenção industrial (o próprio autor) levantando em campo as medidas dos
equipamentos de uma fábrica de cal — transportadoras de correia, roletes, tambores, mancais,
redutores, motores, polias, rotores — para comparar com o PCM do cliente. Conhece bem o domínio
mecânico e o PCM.

Futuro (não decidido): outros técnicos e outras empresas de manutenção podem usar. Por enquanto o
app continua simples e de uso individual.

## Product Purpose

Medir em campo e conferir contra o PCM (Programa de Controle e Manutenção, planilha do cliente):
para cada item, o valor do PCM ao lado do campo, a diferença (Δ), a marcação manual
Confere/Diverge/Não tem, observações e fotos. No fim, devolver o PCM atualizado (.xlsx com as
colunas Medido, Confere/Diverge, Observação e Data), um backup completo (.json) e as fotos (.zip).

Sucesso = o levantamento inteiro de um dia chega ao escritório sem perder nenhuma medida ou foto,
e o técnico não precisou parar para entender o app.

## Positioning

Feito para o pior cenário de campo, não para o escritório: funciona 100% sem sinal, grava cada
toque no aparelho em até ~300 ms (sem botão "salvar"), lê o PCM do próprio cliente (inclusive a
dedução de tambores pelos mancais) e devolve a mesma planilha atualizada, que pode ser importada
de novo dando o mesmo PCM.

## Operating Context

- Fábrica de cal: poeira, calor, **sol forte** na tela, equipamento rodando ao lado.
- Técnico de **luva**, operando com **uma mão**; a atenção está no equipamento, não no celular.
- Celular comum, às vezes fraco, tela de **360 px**; sinal ruim ou nenhum.
- Fluxo: importar o PCM (.xls/.xlsx) → lista de equipamentos por aba → ficha do equipamento com
  um cartão por item → medir, conferir, fotografar → backup e exportação → enviar pelo app de
  arquivos do celular (Downloads → Compartilhar → WhatsApp).
- A versão anterior (página hospedada no claude.ai) falhou em campo: perdeu medidas e a câmera
  não abria.

## Capabilities and Constraints

- Offline total: sem CDN, sem `fetch`, sem fontes externas; tudo no build e no precache do
  service worker.
- Dados no IndexedDB, versionado com migrações testadas; reimportar o PCM nunca apaga medição
  nem foto; restaurar backup guarda antes uma cópia automática.
- Dados reais do cliente nunca entram no repositório (o GitHub Pages é público); exemplos usam
  TAGs fictícias como `XA-TC-01`.
- Interface em pt-BR, textos curtos e diretos; alvos de toque ≥ 48 px; inputs ≥ 16 px; medidas
  com `inputmode="decimal"` aceitando vírgula; temas claro e escuro de alto contraste; câmera só
  com `<label>` + `<input type="file">`.
- Toda tela testada em 360 × 740 (E2E Playwright, offline).
- Terminologia do domínio (TAG, tapete, lonas, rolete de carga/retorno, fresado, LD/LE, Δ,
  Confere/Diverge) está no glossário do CLAUDE.md.
- **Em aberto:** servidor (VPS), contas e segurança para uso por outras empresas — só se a ideia
  for adiante. Hoje não existe backend.

## Brand Commitments

- Nome: **Levantamento PCM** (curto: "Levant. PCM"). O nome fica.
- Ícone, cores e estilo visual podem ser repensados (decisão do usuário, 25/10/2026).
- **Visual: padrão da categoria, Material 3 do Android**, com a régua de acabamento dos apps do
  Google no Android (Arquivos, Keep, Configurações). Escolha do usuário em 25/10/2026, na rodada
  de direção visual (preferiu o familiar a um mundo próprio). Requisitos de campo (sol, luva,
  360 px, offline, sem fonte externa) prevalecem sobre a especificação do Material quando
  conflitam.

## Evidence on Hand

- PCM real só na máquina do autor (`dados/`, fora do git). Fixture fictícia em
  `tests/fixtures/pcm-ficticio.{xls,xlsx}` (gerada por `scripts/gerar-fixture.ts`).
- Não há depoimentos, clientes, números de uso nem logotipo de empresa; não inventar.

## Product Principles

1. **Nunca perder dado.** Qualquer escolha de interface que arrisque uma medida ou foto perde.
2. **Entender o estado sem ler parágrafos.** "Salvo no aparelho", "Pronto para baixar", "N itens
   ainda sem backup": o estado aparece em palavras curtas onde se olha.
3. **Achar a próxima ação de primeira.** Uma ação principal por momento; nada muda de lugar sob o
   dedo; perigoso longe do comum.
4. **Legível ao sol, tocável de luva.** Contraste e tamanho vêm antes de estética.
5. **Simples agora, sem fechar portas.** Uso individual hoje; pode virar ferramenta de equipe.

## Accessibility & Inclusion

Requisitos vêm do campo: contraste alto nos dois temas (texto secundário ≥ 7:1 como meta), alvos
≥ 48 px com folga entre ações, sem depender só de cor (vermelho sempre com ✗/⚠ e texto), sem
gestos finos (pinça), respeitar `prefers-reduced-motion`.
