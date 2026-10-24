#!/usr/bin/env bash
# Stop: roda `npm run typecheck` e os testes unitários quando o código mudou desde a
# última verificação que passou (respostas só de conversa não pagam o custo).
# Se falhar: avisa o usuário e pede ao Claude, UMA vez, para corrigir ou explicar.
set -uo pipefail

raiz="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$raiz" || exit 0
[ -d node_modules ] || exit 0
ja_bloqueou=$(jq -r '.stop_hook_active // false')

# Impressão digital do código-fonte (inclui arquivos novos ainda não versionados).
marca=$(git ls-files -c -o --exclude-standard -- src tests scripts index.html package.json \
  tsconfig.json '*.config.ts' '*.config.js' 2>/dev/null |
  sort | xargs -r -d '\n' sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1)
cache="node_modules/.cache/claude-hooks"
mkdir -p "$cache"
[ "$(cat "$cache/ultima-verificacao-ok" 2>/dev/null)" = "$marca" ] && exit 0

falhas=()
saida_tipos=$(npm run --silent typecheck 2>&1) || falhas+=("typecheck")
saida_testes=$(npx vitest run --reporter=dot 2>&1) || falhas+=("testes unitários")

if [ ${#falhas[@]} -eq 0 ]; then
  echo "$marca" >"$cache/ultima-verificacao-ok"
  exit 0
fi

o_que=$(printf '%s e ' "${falhas[@]}")
o_que=${o_que% e }
trecho=$(printf '%s\n%s\n' "$saida_tipos" "$saida_testes" |
  grep -E 'error TS|FAIL|AssertionError|Expected|Received|✗|×' | head -25)

if [ "$ja_bloqueou" = "true" ]; then
  jq -n --arg m "⚠ Falhou: $o_que. Rode npm run typecheck / npm test." '{systemMessage: $m}'
else
  jq -n \
    --arg m "⚠ Falhou: $o_que. Pedi ao Claude para corrigir." \
    --arg r "Falhou: $o_que.
$trecho
Corrija antes de encerrar, ou explique ao usuário por que ficou assim." \
    '{systemMessage: $m, decision: "block", reason: $r}'
fi
exit 0
