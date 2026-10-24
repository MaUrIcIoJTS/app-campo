---
name: novo-tipo-de-item
description: Use para adicionar ou mudar um tipo de item (template de campos de medição), suas regras de detecção, os extratores do valor do PCM ou o desenho SVG de referência — por exemplo quando muitos itens caem no "genérico" ou o técnico pede campos novos para rotor, grelha, rosca etc.
---

# Novo tipo de item

Um tipo de item tem 4 partes: **detecção** (coluna B/C → tipo), **template** (campos),
**extratores** (valor de referência do PCM para cada campo) e **desenho** (onde medir).

## Passo a passo

1. **Veja o que está caindo no genérico** (local, dados reais — não copie a saída para o repo):
   `npm run pcm:resumo -- --genericos`

2. **Tipo** — acrescente o id em `TipoItem` (`src/dominio/tipos.ts`). Id curto, minúsculo, com
   hífen (`rotor`, `rosca`, `cabo-aco`).

3. **Detecção** — `src/dominio/templates/detectar.ts`. As regras são avaliadas **em ordem**; a
   primeira que casa vence. Texto chega normalizado (MAIÚSCULO, sem acento).
   - Ancore no início (`/^ROTOR\b/`) para não pegar "ÓLEO DA REDUTORA" como redutor.
   - Coloque regras específicas antes das gerais.
   - Em `tests/unit/detectar.test.ts`, adicione casos positivos **e** negativos (nomes que
     parecem mas não são). Use palavras genéricas da coluna B, nunca TAGs reais.

4. **Extratores** — `src/dominio/templates/extratores.ts`: uma função pura por valor, que
   devolve `null` quando não reconhece (a UI então mostra o texto original). Teste em
   `tests/unit/extratores.test.ts` com as grafias encontradas no PCM.

5. **Template** — `src/dominio/templates/registro.ts`, use os helpers `num`/`txt`/`opc`:
   - `id` estável em camelCase (**nunca renomeie** depois que houver medição salva: o id é a
     chave no IndexedDB e a coluna na exportação; se precisar, crie migração).
   - `rotulo` curto em português, com a letra do desenho quando houver (`A — comprimento do tubo`).
   - `unidade` (`mm`, `m`, `cv`, `rpm`, `A`, `un`) e `pcm: (item) => …` quando o PCM tiver o valor.
   - `dica` só se ajudar em campo, em até ~8 palavras.
   - `fotoPlaca: true` para itens com placa (motor, redutor).

6. **Desenho** — `src/ui/desenhos/<id>.tsx`, o id em `IdDesenho`, a entrada em
   `src/ui/desenhos/index.ts` (SVG + legenda de 1–2 frases) e o id em `desenhos` do template:
   - Use as peças de `desenhos/base.tsx`: `Svg`, `Cota` (setas nas duas pontas; `externa` para
     medida curta), `Linha` (extensão), `Guia` (chamada até o rótulo), `Texto`, `Marca` (nº
     explicado na legenda), `Centro`. Classes: `peca`, `cheia`, `escura`, `furo`, `placa`.
     Nada de `<marker>` (some quando o SVG nasce dentro de `<details>` fechado).
   - `viewBox` com **300 de largura** (na tela de 360 px a escala é ~0,96): texto de 15
     (= 14,4 px na tela), traço ≥ 2. Cores só pelas classes (dois temas).
   - Letras e nomes **iguais aos rótulos dos campos**; o que se mede em destaque (primária).
   - Desenho tecnicamente certo antes de bonito (ex.: correia liga eixos paralelos e afastados;
     Ø do cabo no topo dos pernos; malha = vão livre).
   - `tests/e2e/desenhos.spec.ts` confere que todos abrem, texto ≥ 14 px e 360 px; atualize a
     contagem. Teste visual: capturas em 360 px, tema claro e escuro (ver `docs/plano.md`).

7. **Exportação** — confira se os campos novos aparecem em "Medido" no `.xlsx` (skill `exportar-pcm`).

8. **Feche**: `npm test`, `npm run typecheck`, `npm run pcm:resumo` (a cobertura do tipo novo
   deve aparecer) e peça ao subagente `revisor-de-campo` para revisar a ficha.
