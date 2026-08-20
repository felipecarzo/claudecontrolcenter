#!/usr/bin/env bash
# Os casos do reporte-guard (CC-95, 16/08).
#
# O caso que dá nome ao hook é o terceiro: trabalhou e o meta está VAZIO. Foi
# o que aconteceu o dia inteiro em 16/08 — dez itens do ROADMAP fechados, zero
# to-dos no painel — e o `cc-check` não pegou porque ele cobra to-do ABERTO.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/reporte-guard.mjs"
T=$(mktemp -d)
export CC_HOME="$T/casa"
mkdir -p "$CC_HOME/control-center-sessoes"
SESSAO="aaaaaaaa-bbbb-cccc-dddd-eeeeffff0000"
export CLAUDE_CODE_SESSION_ID="$SESSAO"

# $1 json do meta (ou "vazio")
meta() {
  if [ "$1" = "vazio" ]; then rm -f "$CC_HOME/control-center-sessoes/$SESSAO.json"
  else echo "$1" > "$CC_HOME/control-center-sessoes/$SESSAO.json"; fi
}

# $1 nome  $2 arquivo tocado (ou "nada")  $3 esperado
caso() {
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
const ev=[JSON.stringify({type:"user",message:{content:"vai"}})]
if (process.argv[3] !== "nada") ev.push(JSON.stringify({type:"assistant",
  message:{content:[{type:"tool_use",name:"Edit",input:{file_path:process.argv[3]}}]}}))
fs.writeFileSync(process.argv[2], ev.join("\n"))' x "$tr" "$2"
  echo "{\"transcript_path\":\"$tr\",\"session_id\":\"$SESSAO\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

COMPLETO='{"subject":"o backlog visivel","frente":"comunicacao","todos":[{"text":"a","done":false}]}'

echo "— trabalhou e nao reportou —"
meta vazio
caso "editou codigo, meta vazio"        /x/src/app.mjs         2
caso "editou o ROADMAP, meta vazio"     /x/docs/ROADMAP.md     2

echo "— reportou: passa —"
meta "$COMPLETO"
caso "editou codigo com meta completo"  /x/src/app.mjs         0

echo "— reporte pela metade ainda cobra —"
meta '{"subject":"algo","frente":"x"}'
caso "sem todos"                        /x/src/app.mjs         2
meta '{"subject":"algo","todos":[{"text":"a"}]}'
caso "sem frente"                       /x/src/app.mjs         2
meta '{"frente":"x","todos":[{"text":"a"}]}'
caso "sem subject"                      /x/src/app.mjs         2

echo "— turno sem trabalho nao e cobrado —"
meta vazio
caso "so conversou"                     nada                   0
caso "so leu documentacao"              /x/docs/guia.md        0

# ===== CC-221: existir nao basta =====
# Dos 16 agentes medidos em 20/08, dois tinham assunto escrito pelo agente. Os
# outros catorze eram o texto cru dele ou nada, e o hook antigo passava nos dois
# casos: ele so olhava se o campo existia.
#
# $1 nome  $2 texto que ELE mandou  $3 quando (ISO)  $4 esperado
casoPedido() {
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
const ev=[
  JSON.stringify({type:"user",promptSource:"user",timestamp:process.argv[4],
    message:{role:"user",content:process.argv[3]}}),
  JSON.stringify({type:"assistant",
    message:{content:[{type:"tool_use",name:"Edit",input:{file_path:"/x/src/app.mjs"}}]}}),
]
fs.writeFileSync(process.argv[2], ev.join("\n"))' x "$tr" "$2" "$3"
  echo "{\"transcript_path\":\"$tr\",\"session_id\":\"$SESSAO\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $4)"
}

echo "— o assunto nao pode ser eco do que ele digitou —"
meta '{"subject":"vamos commitar entao e fazer o sync depois","frente":"x","todos":[{"text":"a"}],"subjectEm":"2026-08-20T12:00:00.000Z"}'
casoPedido "assunto copiado do pedido dele" \
  "vamos commitar entao e fazer o sync depois, ai eu confiro no telefone" \
  "2026-08-20T11:00:00.000Z" 2

meta '{"subject":"o painel mentia sobre a maquina desligada","frente":"x","todos":[{"text":"a"}],"subjectEm":"2026-08-20T12:00:00.000Z"}'
casoPedido "assunto proprio, escrito pelo agente" \
  "vamos commitar entao e fazer o sync depois, ai eu confiro no telefone" \
  "2026-08-20T11:00:00.000Z" 0

echo "— o assunto nao pode ser mais velho que o ultimo pedido dele —"
meta '{"subject":"o painel mentia sobre a maquina desligada","frente":"x","todos":[{"text":"a"}],"subjectEm":"2026-08-20T12:00:00.000Z"}'
casoPedido "ele pediu outra coisa depois" \
  "agora muda a ordem do cartao, projeto e maquina primeiro" \
  "2026-08-20T13:00:00.000Z" 2

meta '{"subject":"o painel mentia sobre a maquina desligada","frente":"x","todos":[{"text":"a"}],"subjectEm":"2026-08-20T14:00:00.000Z"}'
casoPedido "assunto reescrito depois do pedido" \
  "agora muda a ordem do cartao, projeto e maquina primeiro" \
  "2026-08-20T13:00:00.000Z" 0

# Sem carimbo nao da para saber a idade, e cobrar no escuro seria ruido: o
# assunto se carimba sozinho na proxima vez que o agente reescrever.
meta '{"subject":"o painel mentia sobre a maquina desligada","frente":"x","todos":[{"text":"a"}]}'
casoPedido "sem carimbo, nao cobra idade" \
  "agora muda a ordem do cartao, projeto e maquina primeiro" \
  "2026-08-20T13:00:00.000Z" 0

rm -rf "$T"
