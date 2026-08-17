#!/usr/bin/env bash
# Os casos do forma-guard (17/08).
#
# O caso 1 é REAL: ele pediu tabela, eu editei o CSS e a conferência falava de
# blocos e cards. A palavra "tabela" não aparecia em lugar nenhum.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/forma-guard.mjs"
T=$(mktemp -d)
FALHOU=0

PEDIU_TABELA='vamos criar a visao de tarefas estilo tabela/planilha de roadmap'
PEDIU_LISTA='eu quero um backlog como a lista que tava antes, com o numero da tarefa'
SEM_FORMA='conserta o erro que aparece quando eu abro o painel no celular'

turno() {
  node -e '
const fs = require("fs")
const [alvo, pedido, tools, texto] = process.argv.slice(2)
const linhas = [JSON.stringify({ type: "user", message: { content: pedido } })]
for (const u of JSON.parse(tools)) {
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
SO_LEU='[{"nome":"Read","entrada":{}}]'

echo "— o que precisa barrar —"
caso "o caso real: pediu tabela, entregou blocos" "$PEDIU_TABELA" "$EDITOU" \
"No telefone cada linha vira um bloco empilhado, e os cards ficaram maiores." 2

caso "pediu tabela, entrega muda sobre a forma" "$PEDIU_TABELA" "$EDITOU" \
"Pronto, esta no ar, recarrega a pagina." 2

caso "pediu lista, entregou grafico" "$PEDIU_LISTA" "$EDITOU" \
"Montei um grafico com as tarefas por projeto." 2

echo "— o que tem que passar —"
caso "pediu tabela, entrega fala da tabela" "$PEDIU_TABELA" "$EDITOU" \
"A tabela esta no ar, com sete colunas, e rola de lado no telefone em 390px." 0

caso "pediu lista e entregou lista"        "$PEDIU_LISTA"  "$EDITOU" \
"A lista voltou, com o numero da tarefa na frente de cada linha." 0

caso "pedido sem palavra de forma"         "$SEM_FORMA"    "$EDITOU" \
"Consertado, o erro era o cache velho." 0

caso "so conversou, nao mexeu"             "$PEDIU_TABELA" "$SO_LEU" \
"O formato que voce usa nos projetos e esse." 0

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"stop_hook_active":true}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     segunda volta passa" || { echo "  FALHOU segunda volta"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
