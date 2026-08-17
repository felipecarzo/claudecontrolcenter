#!/usr/bin/env bash
# Os casos do referencia-guard (17/08).
#
# O caso 1 é REAL: o pedido da tabela ("nós já usamos em diversos projetos"),
# seguido de edição e de UM print só. Foi assim que ele recebeu blocos no lugar
# da tabela e só descobriu abrindo o painel.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/referencia-guard.mjs"
T=$(mktemp -d)
FALHOU=0

REF='vamos criar a visao de tarefas estilo tabela/planilha de roadmap. nos ja usamos em diversos projetos'
SEM_REF='cria uma tela nova pra mostrar os agentes parados'

# monta um transcrito: pedido dele, ferramentas usadas, resposta minha
turno() { # arquivo, pedido, json das ferramentas, texto da resposta
  node -e '
const fs = require("fs")
const [alvo, pedido, tools, texto] = process.argv.slice(2)
const usos = JSON.parse(tools)
const linhas = [JSON.stringify({ type: "user", message: { content: pedido } })]
for (const u of usos) {
  linhas.push(JSON.stringify({ type: "assistant", message: { content: [
    { type: "tool_use", name: u.nome, input: u.entrada || {} },
  ] } }))
}
linhas.push(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: texto }] } }))
fs.writeFileSync(alvo, linhas.join("\n"))
' x "$1" "$2" "$3" "$4"
}

caso() { # nome, pedido, tools, resposta, exit esperado
  local tr="$T/t.jsonl"
  turno "$tr" "$2" "$3" "$4"
  echo "{\"transcript_path\":\"$tr\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$5" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $5)"; FALHOU=1; }
}

EDITOU='[{"nome":"Edit","entrada":{"file_path":"/x/src/ui.html"}}]'
EDITOU_1PRINT='[{"nome":"Edit","entrada":{}},{"nome":"SendUserFile","entrada":{"files":["/tmp/a.png"]}}]'
EDITOU_2PRINT='[{"nome":"Edit","entrada":{}},{"nome":"SendUserFile","entrada":{"files":["/tmp/a.png","/tmp/b.png"]}}]'
SO_LEU='[{"nome":"Read","entrada":{}},{"nome":"Bash","entrada":{}}]'

echo "— o que precisa barrar —"
caso "o caso real: referencia, editou, um print so" "$REF" "$EDITOU_1PRINT" "ficou igual ao seu roadmap" 2
caso "referencia e nenhum print"                    "$REF" "$EDITOU"        "pronto, ficou identico" 2

echo "— o que tem que passar —"
caso "dois prints: o par que ele julga"   "$REF"     "$EDITOU_2PRINT" "o original e o novo" 0
caso "um print mais o original em codigo" "$REF"     "$EDITOU_1PRINT" 'o seu formato:

```
| ID | Task | Status |
```

e o novo no print acima' 0
caso "sem referencia no pedido"           "$SEM_REF" "$EDITOU"        "feito" 0
caso "so conversou, nao mexeu em nada"    "$REF"     "$SO_LEU"        "o formato que voce usa e esse" 0

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"stop_hook_active":true}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     segunda volta passa" || { echo "  FALHOU segunda volta"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
