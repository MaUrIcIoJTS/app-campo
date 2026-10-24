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
| 2. Ficha com medição                            | ⏳ próxima — base pronta, ver abaixo                          |
| 3. Fotos e desenhos SVG                         | a fazer                                                       |
| 4. Exportar, backup, restaurar, compartilhar    | a fazer                                                       |
| 5. Ensaio geral (critérios 1–5 no Android)      | a fazer                                                       |

Se atrasar: os desenhos SVG (fase 3) e o `.zip` de fotos (fase 4) podem ficar para depois, porque
o backup `.json` já leva as fotos. **Nunca cortar:** gravação automática, backup e restauração.

## Fase 2 — ficha com medição

### Já existe (commitado, ainda NÃO ligado a nenhuma tela)

- `src/dominio/medicao.ts`: `comValor`, `comConferencia` (✓/✗ por campo, tocar de novo
  desmarca), `comObservacao`, `deltaDoCampo` (leitura estrita: "65O" não vira 65),
  `numeroInvalido`, `numeroAmbiguo` ("12.450" → perguntar), `avisosDoItem` (LD ≠ LE no tapete),
  `itemDiverge`. Testes em `tests/unit/medicao.test.ts`.
- `src/db/diario.ts`: diário síncrono em localStorage (`anotar`, `riscar`, `pendentesNoDiario`)
  para cobrir a janela de 300 ms da fila quando o Android mata o app.
- `src/ui/CampoMedicao.tsx`: um campo da ficha (rótulo + valor do PCM, input `inputmode`
  decimal, ✓/✗ de 52 px, Δ com sinal, avisos; opções como botões grandes).
  **Falta:** o CSS (`.campo-med*`, `.conferir*`, `.opcao`, `.delta`, `.dica`, `.unidade`) e
  corrigir o rótulo do grupo de opções (hoje usa um `<span hidden>` com o id do input).
- `src/dominio/progresso.ts` e a lista já calculam % e divergências a partir de `medicoes`.
- `src/db/salvamento.ts`: `filaDeGravacao.agendar(chave, gravar)` com retentativa, e
  `repositorio.salvarMedicao` / `salvarNota`.

### Falta fazer

1. `TelaEquipamento`: para cada item, os campos do template (`TEMPLATES[item.tipo]`) com
   `CampoMedicao`; observação por item; observação do equipamento (store `notas`).
2. Gravação: em cada alteração, `anotar('medicao:<itemId>', medicao)` **na hora**, depois
   `filaDeGravacao.agendar(...)` que grava no IndexedDB e então `riscar(...)`. Estado local da
   ficha atualizado na hora; `recarregar()` dos dados da lista ao sair da ficha (ou atualizar
   o mapa em memória).
3. Ao abrir o app (antes de `carregarDados`): reaplicar `pendentesNoDiario()` no IndexedDB,
   gravando só se o `atualizadaEm` do diário for mais novo que o do banco, e depois riscar.
4. Avisos do item (LD ≠ LE) e destaque de item que diverge; botão "Próximo item" e
   "Próximo equipamento" (polegar, fim da ficha).
5. Itens "fora do PCM": tambores deduzidos já aparecem; "Adicionar item" manual é opcional.
6. E2E: preencher 20 medidas em vários itens → `page.close()` → nova página offline → conferir
   as 20; teste de fechar 100 ms depois de digitar (o diário tem que salvar).
7. Revisar a ficha com o subagente `revisor-de-campo` e testar no celular (critério 3, parte de
   medidas).

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
