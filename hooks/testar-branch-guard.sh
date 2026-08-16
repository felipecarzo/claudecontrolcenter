#!/usr/bin/env bash
# Os casos do branch-guard (16/08): o comando git que apaga trabalho de quem não
# está olhando. Roda num repositório de mentira, em pasta temporária — testar
# isto no repositório de verdade seria criar o próprio acidente que ele evita.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/branch-guard.mjs"
T=$(mktemp -d)
cd "$T" || exit 1
git init -q . && git config user.email t@t && git config user.name t
echo a > a.txt && git add a.txt && git commit -qm inicial
git branch outra

# $1 nome  $2 comando  $3 saída esperada  [$4 = "sujo" deixa arquivo pendente]
caso() {
  if [ "${4:-}" = "sujo" ]; then echo mudou > a.txt
  else git checkout -q -- . 2>/dev/null; fi
  echo "{\"tool_name\":\"Bash\",\"cwd\":\"$T\",\"tool_input\":{\"command\":$(node -p 'JSON.stringify(process.argv[1])' "$2")}}" \
    | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

echo "— trocar de branch —"
caso "checkout com trabalho pendente"    "git checkout outra"     2 sujo
caso "checkout com a pasta limpa"        "git checkout outra"     0
caso "checkout -b com trabalho"          "git checkout -b nova"   2 sujo
caso "checkout de ARQUIVO nao e troca"   "git checkout -- a.txt"  0 sujo
caso "git switch com trabalho"           "git switch outra"       2 sujo

echo "— destruir o que nao foi commitado —"
caso "reset --hard com trabalho"         "git reset --hard"       2 sujo
caso "reset --hard na pasta limpa"       "git reset --hard"       0
caso "clean -fd com trabalho"            "git clean -fd"          2 sujo
caso "stash passa (da pra desfazer)"     "git stash"              0 sujo

echo "— comando comum nunca pode ser barrado —"
caso "status"                            "git status"             0 sujo
caso "commit"                            "git commit -m x"        0 sujo
caso "log"                               "git log --oneline -5"   0 sujo
caso "diff"                              "git diff"               0 sujo
caso "add"                               "git add ."              0 sujo
caso "nem e git"                         "npm test"               0 sujo

echo "— apagar branch em uso por uma oficina —"
git checkout -q -- .
git worktree add -q "$T/wt" outra 2>/dev/null
caso "branch -D de branch com oficina"   "git branch -D outra"    2
caso "branch -D de branch livre"         "git branch -D fantasma" 0
git worktree remove --force "$T/wt" 2>/dev/null

cd / && rm -rf "$T"
