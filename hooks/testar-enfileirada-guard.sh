#!/usr/bin/env bash
# Os casos do enfileirada-guard (17/08, CC-118).
#
# O texto do caso 1 é REAL: uma das 34 mensagens dele que a fila descartou nesta
# sessão, medidas antes de escrever a trava.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/enfileirada-guard.mjs"
T=$(mktemp -d)
FALHOU=0
AGORA=$(node -e 'process.stdout.write(new Date().toISOString())')

MSG='podemos criar um Hook pra modo continuo. assim o Hook que voce criou fica util pra um modo revisao'

turno() { # arquivo, texto perdido, resposta minha
  node -e '
const fs = require("fs")
const [alvo, msg, resposta, agora] = process.argv.slice(2)
const linhas = [
  JSON.stringify({ type: "user", message: { content: "toca o backlog" } }),
  JSON.stringify({ type: "queue-operation", operation: "enqueue", timestamp: agora, content: msg }),
  JSON.stringify({ type: "queue-operation", operation: "remove", timestamp: agora, content: msg }),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: resposta }] } }),
]
fs.writeFileSync(alvo, linhas.join("\n"))
' x "$1" "$2" "$3" "$4"
}

caso() { # nome, texto perdido, resposta, exit esperado
  local tr="$T/t.jsonl"
  turno "$tr" "$2" "$3" "$AGORA"
  echo "{\"transcript_path\":\"$tr\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

echo "— o que precisa barrar —"
caso "mensagem perdida e nao citada" "$MSG" "Pronto, fechei o item do backlog." 2
caso "avisou mas nao citou"          "$MSG" "Chegou uma mensagem sua no meio, mas nao consegui ler." 2

echo "— o que tem que passar —"
caso "citou um trecho do texto dele" "$MSG" \
"Voce escreveu: \"podemos criar um Hook pra modo continuo\". Vou fazer isso." 0
caso "citou reformulando o resto"    "$MSG" \
"Sobre o que voce mandou no meio do turno, assim o Hook que voce criou fica util, entendi e registrei." 0

# 17/08: a trava cobrou citar uma mensagem que eu JA tinha citado dois turnos
# antes, porque olhava so a resposta do turno atual. Cobrar o que ja foi feito e
# o caminho mais curto para trava desligada.
node -e '
const fs = require("fs")
const [alvo, msg, agora] = process.argv.slice(2)
const antes = new Date(Date.parse(agora) + 1000).toISOString()
const depois = new Date(Date.parse(agora) + 60000).toISOString()
fs.writeFileSync(alvo, [
  JSON.stringify({ type: "user", message: { content: "toca o backlog" } }),
  JSON.stringify({ type: "queue-operation", operation: "enqueue", timestamp: agora, content: msg }),
  JSON.stringify({ type: "queue-operation", operation: "remove", timestamp: agora, content: msg }),
  JSON.stringify({ type: "assistant", timestamp: antes, message: { content: [{ type: "text",
    text: "Voce escreveu: " + msg + ". Feito." }] } }),
  JSON.stringify({ type: "user", message: { content: "continua" } }),
  JSON.stringify({ type: "assistant", timestamp: depois, message: { content: [{ type: "text",
    text: "Seguindo com o proximo item do backlog." }] } }),
].join("\n"))
' x "$T/antes.jsonl" "$MSG" "$AGORA"
echo "{\"transcript_path\":\"$T/antes.jsonl\"}" | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     ja citada em turno anterior nao cobra de novo" \
  || { echo "  FALHOU ja citada em turno anterior"; FALHOU=1; }

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"stop_hook_active":true}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     segunda volta passa" || { echo "  FALHOU segunda volta"; FALHOU=1; }

# sem operacao de fila nenhuma: nada a cobrar
node -e 'require("fs").writeFileSync(process.argv[1], [
  JSON.stringify({type:"user",message:{content:"oi"}}),
  JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"feito"}]}}),
].join("\n"))' "$T/limpo.jsonl"
echo "{\"transcript_path\":\"$T/limpo.jsonl\"}" | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     sessao sem fila descartada" || { echo "  FALHOU sessao sem fila"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
