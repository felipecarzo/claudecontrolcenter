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

rm -rf "$T"
