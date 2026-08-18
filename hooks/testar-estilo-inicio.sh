#!/usr/bin/env bash
# Os casos do estilo-inicio (CC-137, 18/08).
#
# Ela injeta o padrão de resposta dele no começo da sessão. Não barra nada, e o
# que se mede é o que ela ENTREGA: um JSON com o texto do padrão dentro de
# `additionalContext`, no evento de abertura.
#
# O princípio dela é o oposto do de uma trava: falha em silêncio em tudo. Hook
# de estilo que quebra a abertura da sessão é pior do que estilo ruim.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$RAIZ/hooks/estilo-inicio.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

echo "== estilo-inicio =="

saida=$(echo '{"hook_event_name":"SessionStart"}' | node "$HOOK" 2>/dev/null)
codigo=$?

confere() { # nome, condicao já avaliada
  if [ "$2" = 0 ]; then echo "  ok     $1"; else echo "  FALHOU $1"; FALHOU=1; fi
}

echo "— o que ela precisa entregar —"
[ "$codigo" = 0 ]; confere "sai com 0: ela informa, nao barra" $?
echo "$saida" | grep -q 'additionalContext'; confere "entrega o texto em additionalContext" $?
echo "$saida" | grep -q 'SessionStart'; confere "declara o evento de abertura" $?
echo "$saida" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j = JSON.parse(s)
  process.exit(j.hookSpecificOutput?.additionalContext?.length > 100 ? 0 : 1)
})'
confere "o texto do padrao vem inteiro, nao um resumo" $?

echo "— nao pode quebrar a abertura da sessao —"
echo '' | node "$HOOK" > /dev/null 2>&1
confere "entrada vazia" $?
echo 'isto nao e json' | node "$HOOK" > /dev/null 2>&1
confere "entrada que nao e json" $?

exit $FALHOU
