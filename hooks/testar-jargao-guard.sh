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

rm -rf "$T"
