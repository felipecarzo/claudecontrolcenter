#!/bin/bash
# Duas pastas de verdade, criadas aqui: uma COM quadro de rotas e uma sem.
#
# Antes de 17/08 isto usava um caminho `D:/...` que não existe no Linux e a
# variavel `$TEMP`, que so existe no Windows. Resultado: os dois cwd caiam no
# `process.cwd()` do proprio hook (este repositorio, que TEM quadro), entao o
# caso "projeto sem quadro" comparava contra a pasta errada e falhava, e os
# casos de bloqueio passavam por motivo diferente do que diziam testar.
# Achado pelo `cc hooks testar`, que roda todas as travas de uma vez.
HOOK="$HOME/.claude/hooks/git-add-guard.mjs"
BASE=$(mktemp -d)
REPO="$BASE/com-quadro"
TEMP="$BASE/sem-quadro"
mkdir -p "$REPO/docs" "$TEMP"
printf '# Rotas\n\n| Rota | Status | Quem | Desde |\n|---|---|---|---|\n| `x` | 🟢 livre | — | — |\n' \
  > "$REPO/docs/ROTAS-ATIVAS.md"
trap 'rm -rf "$BASE"' EXIT
FALHOU=0

# caso <nome> <esperado> <cwd> <comando>
caso() {
  local nome="$1" esperado="$2" cwd="$3" cmd="$4"
  local json saida codigo obtido
  json=$(node -e '
    const [cwd, command] = process.argv.slice(1)
    process.stdout.write(JSON.stringify({ cwd, tool_input: { command } }))
  ' "$cwd" "$cmd")
  saida=$(echo "$json" | node "$HOOK" 2>&1); codigo=$?
  obtido="libera"; [ $codigo -eq 2 ] && obtido="bloqueia"
  if [ "$obtido" = "$esperado" ]; then
    echo "  ok   $nome"
  else
    echo "  FALHA $nome — esperado=$esperado obtido=$obtido"
    echo "$saida" | head -3
    FALHOU=1
  fi
}

echo "== git-add-guard =="

caso "git add ."                    "bloqueia" "$REPO" 'git add .'
caso "git add -A"                   "bloqueia" "$REPO" 'git add -A'
caso "git add --all"                "bloqueia" "$REPO" 'git add --all'
caso "git add -u"                   "bloqueia" "$REPO" 'git add -u'
caso "git commit -am"               "bloqueia" "$REPO" 'git commit -am "mensagem"'
caso "git commit -a -m"             "bloqueia" "$REPO" 'git commit -a -m "mensagem"'
caso "encadeado depois de cd"       "bloqueia" "$REPO" 'cd apps && git add . && git commit -m "x"'

caso "caminhos explicitos"          "libera"   "$REPO" 'git add src/lib/dicaTeclas.ts docs/ROADMAP.md'
caso "commit sem -a"                "libera"   "$REPO" 'git commit -m "mensagem normal"'
caso "git status"                   "libera"   "$REPO" 'git status --short'
caso "git add -p (interativo)"      "libera"   "$REPO" 'git add -p src/x.ts'
caso "mensagem CITA git add ."      "libera"   "$REPO" 'git commit -m "explica por que nao usar git add . aqui"'
caso "heredoc CITA git add ."       "libera"   "$REPO" 'git commit -F- <<MSG
fix: alguma coisa

Nao use git add . neste repo, use caminhos.
MSG'
caso "heredoc com -a no texto"      "libera"   "$REPO" 'git commit -F- <<MSG
titulo

texto com -a e --all no meio da frase
MSG'
caso "projeto sem quadro"           "libera"   "$TEMP" 'git add .'
caso "entrada sem comando"          "libera"   "$REPO" ''

exit $FALHOU
