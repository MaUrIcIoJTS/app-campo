#!/usr/bin/env bash
# PreToolUse (Bash): impede que dados do cliente entrem no git e bloqueia push forçado.
#   - git add / git commit envolvendo dados/ ou planilhas (.xls, .xlsx, .xlsm, .ods, .csv)
#     fora de tests/fixtures/  → bloqueado (inclusive `git add -f`, `git add -A`, `commit -a`);
#   - git push --force / -f / --force-with-lease / +refspec → bloqueado.
# Saída 2 = o comando NÃO roda; a mensagem em stderr volta para o Claude.
set -uo pipefail

cmd=$(jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0
grep -qE '(^|[^[:alnum:]_.-])git([[:space:]]|$)' <<<"$cmd" || exit 0

raiz="${CLAUDE_PROJECT_DIR:-$(pwd)}"

bloquear() {
  echo "BLOQUEADO pelo hook proteger-git: $1" >&2
  echo "Dados reais do cliente nunca vão para o git (ver CLAUDE.md, regras invioláveis)." >&2
  exit 2
}

# Lê caminhos (um por linha) e imprime só os proibidos.
proibidos() {
  grep -Ei '(^|/)dados(/|$)|\.(xls|xlsx|xlsm|ods|csv)$' | grep -Ev '^(\./)?tests/fixtures/' || true
}

analisou_algum=false

# Analisa cada trecho do comando separado por && || ; | e quebras de linha.
while IFS= read -r seg; do
  # Tokeniza respeitando aspas, sem executar nada (xargs só imprime).
  mapfile -t toks < <(xargs -n1 printf '%s\n' <<<"$seg" 2>/dev/null)
  [ "${#toks[@]}" -gt 0 ] || continue

  # Acha o "git" e pula as opções globais (-C dir, -c chave=valor, --no-pager…).
  i=0
  while [ $i -lt ${#toks[@]} ] && [[ "${toks[$i]}" != "git" && "${toks[$i]}" != */git ]]; do i=$((i + 1)); done
  [ $i -lt ${#toks[@]} ] || continue
  i=$((i + 1))
  while [ $i -lt ${#toks[@]} ] && [[ "${toks[$i]}" == -* ]]; do
    case "${toks[$i]}" in -C | -c) i=$((i + 2)) ;; *) i=$((i + 1)) ;; esac
  done
  [ $i -lt ${#toks[@]} ] || continue
  sub="${toks[$i]}"
  args=("${toks[@]:$((i + 1))}")
  analisou_algum=true

  case "$sub" in
    push)
      for a in "${args[@]}"; do
        case "$a" in
          --force | --force-with-lease* | --force-if-includes | --mirror) bloquear "git push forçado ($a)." ;;
          --*) ;;
          -*f*) bloquear "git push forçado ($a)." ;;
          +*) bloquear "git push com refspec forçado ($a)." ;;
        esac
      done
      ;;

    add)
      # 1) caminhos citados no comando
      ruins=$(printf '%s\n' "${args[@]}" | grep -v '^-' | proibidos)
      [ -z "$ruins" ] || bloquear "git add de arquivo de dados: $(echo $ruins)"
      # 2) o que o git REALMENTE adicionaria (pega -A, ., -f, globs…)
      if saida=$(git -C "$raiz" add --dry-run --ignore-missing "${args[@]}" 2>/dev/null); then
        ruins=$(sed -nE "s/^add '(.*)'$/\1/p" <<<"$saida" | proibidos)
        [ -z "$ruins" ] || bloquear "git add incluiria arquivos de dados: $(echo $ruins)"
      fi
      ;;

    commit)
      # Ignora o texto da mensagem (-m/-F) e confere pathspecs, índice e -a.
      paths=() todos=false pula=false
      for a in "${args[@]}"; do
        if $pula; then pula=false; continue; fi
        case "$a" in
          -m | --message | -F | --file | -C | -c | --author | --date | --fixup | --squash) pula=true ;;
          --message=* | --file=* | --author=* | --date=*) ;;
          --all) todos=true ;;
          --*) ;;
          -*)
            [[ "$a" =~ ^-[^m]*a ]] && todos=true # -a, -am, -va…
            [[ "$a" == *m ]] && pula=true        # -am "msg": o próximo token é a mensagem
            ;;
          *) paths+=("$a") ;;
        esac
      done
      ruins=$( {
        printf '%s\n' "${paths[@]}"
        git -C "$raiz" diff --cached --name-only 2>/dev/null
        $todos && git -C "$raiz" diff --name-only 2>/dev/null
      } | proibidos)
      [ -z "$ruins" ] || bloquear "o commit incluiria arquivos de dados: $(echo $ruins)"
      ;;
  esac
done < <(sed -E 's/(&&|\|\||;|\|)/\n/g' <<<"$cmd")

# Qualquer commit (mesmo os que não deu para tokenizar, como mensagem em HEREDOC):
# o que já está no índice não pode ter dado do cliente.
if grep -qE 'git([[:space:]]+-[^[:space:]]+)*[[:space:]]+commit' <<<"$cmd"; then
  ruins=$(git -C "$raiz" diff --cached --name-only 2>/dev/null | proibidos)
  [ -z "$ruins" ] || bloquear "há arquivos de dados no índice: $(echo $ruins). Use git rm --cached."
fi

# Comando com git que não deu para analisar (ex.: dentro de bash -c "…"): checagem textual,
# ignorando o texto da mensagem de commit (-m, -F, HEREDOC).
if ! $analisou_algum && grep -qE 'git[[:space:]]+(add|commit)' <<<"$cmd"; then
  alvo=$(tr '\n' ' ' <<<"$cmd" | sed -E 's/[[:space:]](-m|--message|-F|<<).*//')
  grep -qEi '(^|[[:space:]"'"'"'/])dados(/|[[:space:]"'"'"']|$)|\.(xls|xlsx|xlsm|ods|csv)\b' <<<"$alvo" &&
    ! grep -qE 'tests/fixtures/' <<<"$alvo" &&
    bloquear "comando git com caminho de dados que não consegui analisar."
fi
exit 0
