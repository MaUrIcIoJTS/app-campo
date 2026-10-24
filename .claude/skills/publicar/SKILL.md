---
name: publicar
description: Use antes de qualquer git push ou deploy no GitHub Pages — checklist de typecheck, lint, testes, E2E, build, tamanho do bundle e garantia de que nenhum dado real do cliente está no diff — e para conferir se o deploy no Pages funcionou.
---

# Publicar

O site do GitHub Pages é **público**. Ele é só a "casca": os dados entram pelo botão de
importar no celular. `git push` sempre pede confirmação do usuário.

## Checklist antes do push

1. **Nenhum dado real no repositório nem no diff**

   ```bash
   git status --short
   git ls-files | grep -Ei '^dados/|\.(xls|xlsx|xlsm|ods|csv)$' | grep -v '^tests/fixtures/'   # tem que sair vazio
   git diff origin/main --stat   # (ou git show --stat no 1º push) — revise a lista de arquivos
   ```

   Leia o diff procurando texto copiado do PCM real: nomes de pessoas, TAGs da planta, números
   de série, marcas, nome do cliente, caminhos de rede. Exemplos e fixtures usam `XA-…`/`XB-…`.
   O hook `proteger-git.sh` e o CI barram arquivos de dados, mas **texto colado não**.

2. **Qualidade**

   ```bash
   npm run typecheck && npm run lint && npm run format:check && npm test
   npm run test:e2e
   ```

3. **Build e tamanho**

   ```bash
   npm run build
   ```

   Confira na saída:
   - chunk principal (`assets/index-*.js`) **< 60 kB gzip** — SheetJS e JSZip têm que estar em
     chunks separados (`import()` dinâmico), nunca no principal;
   - linha `precache N entries (X KiB)`: todos os chunks entram (inclusive os dinâmicos);
     total esperado < 1,5 MB;
   - nenhum aviso de arquivo acima de `maximumFileSizeToCacheInBytes`.

4. **Commit** em Conventional Commits, em português. Depois peça ao usuário para autorizar o push.

## Depois do push

1. GitHub → **Actions** → workflow "Deploy no GitHub Pages": jobs `verificar`, `e2e`, `build`,
   `deploy` verdes. (Primeira vez: Settings → Pages → Source = **GitHub Actions**.)
2. Abra `https://<usuario>.github.io/<repo>/`:
   - carrega sem erro no console; DevTools → Application → Manifest sem erros;
   - recarregue com Network "Offline": abre igual.
3. No celular já instalado: abrir o app com internet → aparece "Nova versão disponível" →
   **Atualizar** → confira que os dados continuam lá.
4. Se algo quebrar em campo: reverta com um novo commit (`git revert`), nunca com push forçado.
