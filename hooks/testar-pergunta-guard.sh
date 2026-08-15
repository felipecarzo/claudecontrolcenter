#!/bin/bash
# Gate do gate: pergunta decisiva vai na caixa, prosa comum passa.
#
# O equilíbrio é o ponto: barrar de menos e ele me pega de novo; barrar demais e
# o hook vira hook desligado, que é pior que não ter.
H="$(dirname "$0")/pergunta-guard.mjs"
T=$(mktemp -d); ok=0; falhou=0

faz() {
  node -e '
    const fs=require("fs")
    fs.writeFileSync(process.argv[1], [
      JSON.stringify({type:"user",message:{content:"oi"}}),
      JSON.stringify({type:"assistant",message:{content:[{type:"text",text:process.argv[2]}]}}),
    ].join("\n"))' "$T/t.jsonl" "$1"
}
testa() {
  faz "$2"
  echo "{\"transcript_path\":\"$T/t.jsonl\"}" | node "$H" >/dev/null 2>&1
  if [ "$?" = "$3" ]; then echo "  ok   $1"; ok=$((ok+1))
  else echo "  FALHOU $1 (esperava saida $3)"; falhou=$((falhou+1)); fi
}

testa "sigo?"                     "Fiz tudo.

Sigo para o proximo?" 2
testa "quer que eu"               "Pronto.

Quer que eu registre no backlog?" 2
testa "posso"                     "Terminei.

Posso commitar?" 2
testa "qual voce prefere"         "Sao dois caminhos.

Qual deles voce prefere?" 2
testa "relatorio puro"            "Fiz as tres telas e o gate passou. Commitei em abc123." 0
testa "retorica no meio"          "Por que falha? Porque o regex nao casa CRLF.

Consertado." 0
testa "pergunta dentro de codigo" "Rodei:

\`\`\`
echo 'sigo?'
\`\`\`

Deu certo." 0
testa "duvida tecnica respondida" "O CEP tem digito verificador?

Tem, e o detector confere. Commitado." 0

faz "Sigo?"
echo "{\"transcript_path\":\"$T/t.jsonl\",\"stop_hook_active\":true}" | node "$H" >/dev/null 2>&1
if [ "$?" = "0" ]; then echo "  ok   segunda volta nao repete"; ok=$((ok+1))
else echo "  FALHOU: viraria laco"; falhou=$((falhou+1)); fi

echo '{"transcript_path":"/nao/existe.jsonl"}' | node "$H" >/dev/null 2>&1
if [ "$?" = "0" ]; then echo "  ok   transcrito ausente nao trava o turno"; ok=$((ok+1))
else echo "  FALHOU: travou o turno por nao achar arquivo"; falhou=$((falhou+1)); fi

rm -rf "$T"
echo; echo "pergunta-guard: $ok ok, $falhou falharam"
[ "$falhou" -eq 0 ]
