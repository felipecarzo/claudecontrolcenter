#!/usr/bin/env bash
# Os casos do pronto-guard (CC-97, 16/08).
#
# O hook existe porque "feito" sem prova é opinião do agente, e é o que ele mais
# teme: "voce diz que fez, eu confio, e no momento seguinte eu descubro que nao
# eh exatamente o que eu pedi".
#
# O caso mais importante é o último: tarefa fechada em OUTRO turno não pode ser
# cobrada de novo, senão o hook vira ruído permanente e acaba desligado.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/pronto-guard.mjs"
T=$(mktemp -d)
export CC_HOME="$T/casa"
mkdir -p "$CC_HOME/control-center-sessoes"
SESSAO="aaaaaaaa-bbbb-cccc-dddd-eeeeffff0000"
export CLAUDE_CODE_SESSION_ID="$SESSAO"

meta() { echo "$1" > "$CC_HOME/control-center-sessoes/$SESSAO.json"; }

# $1 nome  $2 texto que aparece no transcrito do turno  $3 esperado
caso() {
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], [
 JSON.stringify({type:"user",message:{content:"vai"}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:process.argv[3]}]}}),
].join("\n"))' x "$tr" "$2"
  echo "{\"transcript_path\":\"$tr\",\"session_id\":\"$SESSAO\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

echo "— fechou sem prova —"
meta '{"todos":[{"text":"o hook que cobra o reporte","done":true}]}'
caso "fechada agora, sem prova"      "fechei o hook que cobra o reporte" 2

echo "— fechou com prova: passa —"
meta '{"todos":[{"text":"o hook que cobra o reporte","done":true,"prova":"8 casos verdes"}]}'
caso "fechada agora, com prova"      "fechei o hook que cobra o reporte" 0

echo "— nada fechado: passa —"
meta '{"todos":[{"text":"o hook que cobra o reporte","done":false}]}'
caso "tarefa ainda aberta"           "trabalhando no hook que cobra o reporte" 0

echo "— sem lista, quem cobra e o reporte-guard —"
meta '{"todos":[]}'
caso "nenhum to-do registrado"       "fiz um monte de coisa" 0

echo "— pendencia ANTIGA nao e cobrada de novo —"
meta '{"todos":[{"text":"algo de ontem que ninguem provou","done":true}]}'
caso "fechada em outro turno"        "hoje eu falei de outro assunto" 0

rm -rf "$T"
