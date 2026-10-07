#!/usr/bin/env bash
# Os casos do jargao-guard (16/08).
#
# O caso que dá nome ao hook é o primeiro, e é uma resposta REAL que eu mandei:
# ele leu, não entendeu, e disse "eu não lembro o que que é reporte guard".
#
# Os dois últimos são o que impede o hook de virar insuportável: bloco de código
# e explicação de comando PRECISAM do nome exato, e não podem ser contados.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/jargao-guard.mjs"
T=$(mktemp -d)

caso() {
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], [
 JSON.stringify({type:"user",message:{content:"e ai"}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:process.argv[3]}]}}),
].join("\n"))' x "$tr" "$2"
  echo "{\"transcript_path\":\"$tr\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

echo "— o que precisa barrar —"
caso "a resposta real que ele nao entendeu" \
"CC-95 a raiz. O reporte-guard me devolve quando mexo em codigo ou no ROADMAP
sem ter escrito subject, frente e a lista de todos. O cc-check nao pegava porque
cobra to-do aberto. Ver hooksCatalogo.mjs e meta.json." 2

caso "tabela cheia de nome de hook" \
"Feito. O fluxo-guard, o gate-guard e o bancada-guard entraram hoje, mais o
edicao-guard. Todos escrevem no meta.json." 2

echo "— o que tem que passar —"
caso "so o efeito, sem nome nenhum" \
"Agora, se eu trabalhar e nao anotar no painel o que estou fazendo, o sistema me
obriga a voltar e anotar antes de encerrar. E nao consigo mais marcar tarefa
como feita sem dizer como testei." 0

caso "um nome so, depois da explicacao" \
"O sistema me obriga a anotar antes de encerrar (reporte-guard, se voce precisar
procurar depois). O resto continua igual." 0

caso "bloco de codigo nao conta" \
'Rode isto pra ligar:

```bash
node cc.mjs hooks install
node cc.mjs done "tarefa" --prova "npm test verde"
```

Depois disso o painel passa a cobrar a prova.' 0

caso "resposta curta e comum" "Feito, commitado." 0

# CC-942: recado de um executor (isMeta, mas turnOrigin peer) abre turno novo.
# A resposta cheia de nome veio ANTES dele; a de agora é limpa e tem de passar.
turno_novo() {
  local tr="$T/t2.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], [
 JSON.stringify({type:"user",message:{content:"seguir"},turnOrigin:"human"}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"O reporte-guard, o fluxo-guard e o gate-guard escrevem no meta.json e no hooksCatalogo.mjs."}]}}),
 JSON.stringify({type:"user",isMeta:true,turnOrigin:"peer",message:{content:"Another Claude session sent a message"}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"Conferi a entrega do executor: os testes passam e nada real foi tocado."}]}}),
].join("\n"))' x "$tr"
  echo "{\"transcript_path\":\"$tr\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "0" ] && echo "  ok     recado de executor abre turno: nome da resposta anterior nao conta" || echo "  FALHOU recado de executor abre turno (saiu $s, esperava 0)"
}
turno_novo

rm -rf "$T"
