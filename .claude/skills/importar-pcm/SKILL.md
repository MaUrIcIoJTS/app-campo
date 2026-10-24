---
name: importar-pcm
description: Use ao mexer na leitura da planilha do PCM (src/dominio/pcm/), quando a importação trouxer equipamentos ou itens errados/faltando, quando chegar um PCM novo do cliente, para rodar o resumo contra dados/pcm.xls ou para regenerar as fixtures anonimizadas de teste.
---

# Importar o PCM

## Como o parser lê a planilha

Código: `src/dominio/pcm/parser.ts` (`lerPcm` → `parseAba`), TAG em `src/dominio/pcm/tag.ts`,
tipo do item em `src/dominio/templates/detectar.ts`.

1. Lê **todas as abas** com SheetJS (`sheet_to_json`, `header: 1`, `raw: false` → texto como aparece).
2. Acha a linha com "EQUIPAMENTOS PARA INSP…" na coluna A (o original escreve "INSPENÇÃO");
   os dados começam **2 linhas depois** (cabeçalho de 2 linhas). Se não achar, usa a linha 7 e avisa.
3. Para em "OBSERVAÇÕES" na coluna A. Tudo abaixo (notas, assinaturas, revisão, caminho de rede)
   é ignorado. Se não achar, lê até o fim e avisa.
4. Coluna A preenchida = **novo equipamento** (as células são mescladas; as linhas seguintes
   herdam). TAG = primeiro código `XX-XX-NN` (3 blocos); o nome exibido fica sem as TAGs.
5. Colunas B/C/D = item / especificação / quantidade. Linha com A preenchida e B vazia, mas com
   C ou D (existe no real) → item `"(sem descrição)"`. Linha toda vazia → pulada.
6. Tipo do item = `detectarTipo(colunaB, colunaC)`; "CORREIA" sozinha decide pela especificação
   (tapete × correia em V).
7. Equipamentos com tapete ganham **tambores deduzidos**: `max(2, ceil(Σ qtd. de "MANCAL…" / 2))`,
   com a especificação dos mancais como referência do Ø do eixo.
8. Cada item guarda `linha` (0-based) para a exportação escrever ao lado da linha original.

Avisos vão em `AbaPcm.avisos` e devem aparecer para o usuário na tela de importação.

## Rodar contra o PCM real (só local, só leitura)

```bash
npm run pcm:resumo                  # dados/pcm.xls
npm run pcm:resumo -- --genericos   # lista todos os itens que caíram no "genérico"
npm run pcm:resumo -- outro.xlsx    # outro arquivo
```

Mostra equipamentos/itens por aba, equipamentos sem TAG, tambores deduzidos, tipos detectados e
quanto da referência do PCM os extratores conseguiram ler.

**Privacidade:** a saída contém dados do cliente. Use só para calibrar. Não cole a saída em
commit, PR, issue, teste, fixture ou documentação.

## Quando o PCM mudar ou um caso novo aparecer

1. Rode o resumo e compare com o anterior (abas, contagens, avisos).
2. Reproduza o caso **com texto inventado** em `scripts/gerar-fixture.ts` (TAGs `XA-…`, `XB-…`;
   nada de nomes de pessoas, marcas, números de série ou TAGs reais).
3. `npm run pcm:fixture` regenera `tests/fixtures/pcm-ficticio.xls` e `.xlsx`.
4. Escreva o teste em `tests/unit/parser.test.ts` (ou `detectar.test.ts`) e veja falhar.
5. Corrija o parser, rode `npm test` e `npm run pcm:resumo` de novo.

## Armadilhas conhecidas

- O SheetJS ESM não grava em disco sozinho: use `XLSX.write(..., { type: 'buffer' })` + `fs`.
- `raw: false` é proposital: a especificação tem que vir como o usuário vê no Excel.
- No celular o arquivo chega por `<input type="file" accept=".xls,.xlsx">`; leia com
  `file.arrayBuffer()` e importe o parser com `import()` dinâmico (SheetJS é pesado).
- Guarde o **Blob original** na importação: a exportação parte dele para manter a estrutura.
- Reimportar nunca apaga medições: elas são ligadas ao `id` do item; se o layout do PCM mudar
  (linhas inseridas), os ids mudam — tratar com casamento por TAG + nome do item antes de
  substituir (ver plano, fase 1).
