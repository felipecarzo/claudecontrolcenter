#!/usr/bin/env bash
# Os casos do routia-inicio (CC-137, 18/08).
#
# Ela mostra o quadro de rotas na abertura da sessão, para ninguém começar a
# editar sem saber quem está em quê. Não barra: informa.
#
# O caso que mais importa é o do projeto SEM quadro. O método é opt-in por
# repositório, e falar sobre rotas onde ninguém usa rotas seria ruído em toda
# abertura de sessão de todo projeto.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$RAIZ/hooks/routia/routia-inicio.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

echo "== routia-inicio =="

quadro() { # $1 = nome do projeto, resto = linhas do quadro
  local dir="$T/$1"; mkdir -p "$dir/docs"; shift
  printf '%s\n' "$@" > "$dir/docs/ROTAS-ATIVAS.md"
  echo "$dir"
}

COM_OCUPADA=$(quadro p1 "# Rotas ativas" "" "| Rota | Status | Quem | Desde |" "|---|---|---|---|" \
  "| \`cockpit\` | 🔴 ocupada | abcd1234 — a entrevista na tela | hoje |" \
  "| \`front\` | 🟢 livre | — | — |")
SO_LIVRES=$(quadro p2 "# Rotas ativas" "" "| Rota | Status | Quem | Desde |" "|---|---|---|---|" \
  "| \`cockpit\` | 🟢 livre | — | — |")
SEM_QUADRO="$T/p3"; mkdir -p "$SEM_QUADRO"

fala() { # nome, quer(sim|nao), trecho, cwd
  local saida achou=nao
  saida=$(echo "{\"cwd\":\"$4\",\"hook_event_name\":\"SessionStart\"}" | node "$HOOK" 2>&1)
  echo "$saida" | grep -qiF "$3" && achou=sim
  if [ "$achou" = "$2" ]; then echo "  ok     $1"; else
    echo "  FALHOU $1 (esperava $2 para \"$3\")"; echo "$saida" | head -3 | sed 's/^/         /'; FALHOU=1
  fi
}

echo "— o que precisa aparecer na abertura —"
fala "avisa que a rota do cockpit tem dono" sim "cockpit" "$COM_OCUPADA"
fala "diz quem e o dono, para dar com quem falar" sim "abcd1234" "$COM_OCUPADA"

echo "— o que tem que ficar calado —"
fala "projeto sem quadro nenhum: o metodo e opt-in" nao "rota" "$SEM_QUADRO"

echo "— nao pode quebrar a abertura da sessao —"
echo '{}' | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo "{\"cwd\":\"$COM_OCUPADA\"}" | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     sai com 0 mesmo tendo o que dizer" || { echo "  FALHOU deveria liberar"; FALHOU=1; }

exit $FALHOU
