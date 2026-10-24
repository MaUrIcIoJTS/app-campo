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

6. **Desenho** — `src/ui/desenhos/<id>.tsx` (fase 3) e o id em `IdDesenho`:
   - SVG inline, `viewBox` sem `width/height` fixos, `stroke="currentColor"` (funciona nos 2 temas).
   - Legível em 360 px: traço ≥ 2 px, textos ≥ 14 px, poucas cotas, letras iguais às dos campos.
   - Cotas com setas nas duas pontas; o que é medido fica em destaque (cor primária).
   - Teste visual: abrir a ficha em 360 px, tema claro e escuro.

7. **Exportação** — confira se os campos novos aparecem em "Medido" no `.xlsx` (skill `exportar-pcm`).

8. **Feche**: `npm test`, `npm run typecheck`, `npm run pcm:resumo` (a cobertura do tipo novo
   deve aparecer) e peça ao subagente `revisor-de-campo` para revisar a ficha.
