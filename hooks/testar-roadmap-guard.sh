#!/usr/bin/env bash
# Os casos do roadmap-guard (CC-137, 18/08).
#
# Esta trava AVISA e libera: sai sempre com 0, e o que se mede é o texto. Faz
# sentido, porque mover item concluído para o diário é trabalho de encerramento,
# não coisa que se faça no meio de um turno.
#
# A regra está na linha 3 do próprio ROADMAP: só o que está aberto. Em 14/08 o
# acúmulo levou o arquivo a 993 linhas, quase metade descrevendo passado.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== roadmap-guard =="

projeto() { # monta um projeto com o ROADMAP pedido
  local dir="$T/$1"
  mkdir -p "$dir/docs"
  shift
  printf '%s\n' "$@" > "$dir/docs/ROADMAP.md"
  echo "$dir"
}

COM_FEITOS=$(projeto p1 "# ROADMAP" "" "### CC-01 ✅ 17/08 — a entrevista na tela" "" \
  "### CC-02 — o botao de projeto novo" "" "### CC-03 ✅ 18/08 — as travas sem teste")
SO_ABERTOS=$(projeto p2 "# ROADMAP" "" "### CC-02 — o botao de projeto novo" "" "### CC-04 — o resto")
SUBSECAO=$(projeto p3 "# ROADMAP" "" "### CC-02 — o botao de projeto novo" "" \
  "#### ✅ Primeira fatia, 17/08" "" "Isto e uma etapa DENTRO de um item aberto.")

echo "— o que precisa avisar —"
diz "acusa os dois concluidos parados la dentro" roadmap-guard sim "2 itens concluídos" \
  "{\"cwd\":\"$COM_FEITOS\",\"transcript_path\":\"$T/x\"}"
diz "diz QUAIS sao, nao so quantos" roadmap-guard sim "a entrevista na tela" \
  "{\"cwd\":\"$COM_FEITOS\",\"transcript_path\":\"$T/x\"}"

echo "— o que tem que ficar calado —"
diz "roadmap so com item aberto" roadmap-guard nao "concluído" \
  "{\"cwd\":\"$SO_ABERTOS\",\"transcript_path\":\"$T/x\"}"
diz "etapa concluida DENTRO de item aberto nao conta" roadmap-guard nao "concluído" \
  "{\"cwd\":\"$SUBSECAO\",\"transcript_path\":\"$T/x\"}"
diz "projeto sem roadmap nenhum" roadmap-guard nao "concluído" \
  "{\"cwd\":\"$T\",\"transcript_path\":\"$T/x\"}"

echo "— higiene —"
echo '{}' | node "$(caminho roadmap-guard)" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia não trava" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
# esta trava avisa e libera SEMPRE: sair com 2 travaria o encerramento, que é
# justamente o momento em que ela fala
echo "{\"cwd\":\"$COM_FEITOS\"}" | node "$(caminho roadmap-guard)" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     avisa sem barrar, mesmo com itens parados" || { echo "  FALHOU deveria liberar"; FALHOU=1; }

exit $FALHOU
