#!/usr/bin/env bash
# PostToolUse (Edit|Write): Prettier + ESLint --fix SÓ no arquivo editado.
# Se o ESLint ainda acusar erro depois do --fix, sai com 2: a mensagem volta para o Claude corrigir.
set -uo pipefail

raiz="${CLAUDE_PROJECT_DIR:-$(pwd)}"
arquivo=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$arquivo" ] || exit 0
case "$arquivo" in /*) ;; *) arquivo="$raiz/$arquivo" ;; esac
[ -f "$arquivo" ] || exit 0

# Só arquivos do projeto; nunca dependências, build, dados do cliente ou fixtures binárias.
case "$arquivo" in "$raiz"/*) ;; *) exit 0 ;; esac
case "$arquivo" in */node_modules/* | */dist/* | */dev-dist/* | */dados/* | */tests/fixtures/*) exit 0 ;; esac

bin="$raiz/node_modules/.bin"
[ -x "$bin/prettier" ] || exit 0
cd "$raiz" || exit 0

"$bin/prettier" --write --ignore-unknown --log-level warn "$arquivo" >/dev/null 2>&1 || true

case "$arquivo" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs)
    if ! saida=$("$bin/eslint" --fix --no-warn-ignored "$arquivo" 2>&1); then
      printf 'ESLint ainda acusa problemas em %s (corrija):\n%s\n' "${arquivo#"$raiz"/}" "$saida" >&2
      exit 2
    fi
    ;;
esac
exit 0
