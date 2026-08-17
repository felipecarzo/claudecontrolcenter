#!/usr/bin/env bash
# Os casos do fila-guard (17/08, CC-117).
#
# O pedido dele, urgente: "qdo eu te peço mil coisas e voce pausa no meio eu
# não sei quanto você implementou e eu perco as ideias". Pausa de entrega
# (com separador) com tarefa aberta no cartão tem que dizer o que ficou.
#
# Roda numa casa isolada (CC_HOME): o cartão de sessão é fabricado, nunca o
# real. Teste que escreve em dado real do Felipe é defeito.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/fila-guard.mjs"
T=$(mktemp -d)
export CC_HOME="$T/casa"
mkdir -p "$CC_HOME/control-center-sessoes"
SID="fila0000-0000-0000-0000-000000000000"

cartao() { # $1 = json dos todos
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], JSON.stringify({todos: JSON.parse(process.argv[3])}))
' x "$CC_HOME/control-center-sessoes/$SID.json" "$1"
}

caso() { # nome, todos, resposta, exit esperado
  cartao "$2"
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], [
 JSON.stringify({type:"user",message:{content:"e ai"}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:process.argv[3]}]}}),
].join("\n"))' x "$tr" "$3"
  echo "{\"transcript_path\":\"$tr\",\"session_id\":\"$SID\"}" | CLAUDE_CODE_SESSION_ID="$SID" node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

FALHOU=0
ABERTA='[{"text":"modo aplicativo no estreito","done":false}]'
FECHADA='[{"text":"modo aplicativo no estreito","done":true,"prova":"print"}]'

echo "— o que precisa barrar —"
caso "pausa com tarefa aberta e resumo mudo sobre a fila" "$ABERTA" \
"Fiz um monte de coisa hoje.

---- // resumo // ----

1. O painel ganhou telas novas.
2. Os testes passam." 2

echo "— o que tem que passar —"
caso "resumo diz o que ficou na fila" "$ABERTA" \
"Trabalho do dia abaixo.

---- // resumo // ----

1. Telas novas: feito, com print.
2. Modo aplicativo: na fila, esperando sua resposta sobre a previa." 0

caso "resumo diz em curso" "$ABERTA" \
"---- // resumo // ----

O modo aplicativo esta em curso, a previa foi mandada." 0

caso "sem separador nao e pausa de entrega" "$ABERTA" \
"ok, ajustei o botao." 0

caso "cartao sem tarefa aberta" "$FECHADA" \
"---- // resumo // ----

Tudo entregue, com prova em cada item." 0

caso "aguardando voce tambem vale" "$ABERTA" \
"---- // resumo // ----

1. Feito: telas.
2. Aguardando sua aprovacao da previa." 0

rm -rf "$T"
exit $FALHOU
