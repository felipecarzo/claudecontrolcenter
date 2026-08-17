#!/usr/bin/env bash
# Os casos do desvio-guard (17/08).
#
# O caso 1 é REAL: o comentário que eu escrevi no CSS ao trocar a tabela que ele
# pediu por blocos empilhados no telefone. Os que passam são comentários
# legítimos deste repositório, e existem para provar que a trava não inviabiliza
# a documentação: "em vez de" aparece 92 vezes aqui, e "de propósito" 72.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/desvio-guard.mjs"
T=$(mktemp -d)
FALHOU=0

PEDIDO_TABELA='vamos criar a visao de tarefas estilo tabela/planilha de roadmap. voce sabe exatamente qual o estilo que eu quis dizer? nos ja usamos em diversos projetos'
PEDIDO_CURTO='pode seguir'

caso() { # nome, pedido dele, texto que vou escrever, exit esperado
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], [
 JSON.stringify({type:"user",message:{content:process.argv[3]}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"ok"}]}}),
].join("\n"))' x "$tr" "$2"
  node -e '
const fs=require("fs")
process.stdout.write(JSON.stringify({
  tool_name:"Edit", transcript_path:process.argv[2],
  tool_input:{file_path:"/tmp/x/src/ui.html", new_string:process.argv[3]},
}))' x "$tr" "$3" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

echo "— o que precisa TRAVAR —"
caso "o comentario real que trocou a tabela por blocos" "$PEDIDO_TABELA" \
'/* A planilha no telefone: cada linha vira um bloco. Rolar sete colunas de lado
   num aparelho de 390px seria pior que nao ter tabela. */
.pl-tab { display: block; }' 2

caso "descarte do que ele pediu, com outra palavra" "$PEDIDO_TABELA" \
'// usei cards em vez de tabela porque cabe na tela
const x = 1' 2

caso "optei por outra coisa" "$PEDIDO_TABELA" \
'/* optei por lista no lugar da planilha aqui */' 2

echo "— o que tem que PASSAR (senao a documentacao fica inviavel) —"
caso "comentario legitimo, nada do pedido citado" "$PEDIDO_TABELA" \
'/* `os.cpus()` em vez de WMI: responde o mesmo em 3ms, e o WMI levava 3,2s. */' 0

caso "decisao registrada com de proposito" "$PEDIDO_TABELA" \
'/* O cache guarda blocos de 2 minutos de proposito: somar na varredura
   exigiria reler 800 MB a cada mudanca de corte. */' 0

caso "cita o termo mas nao justifica desvio" "$PEDIDO_TABELA" \
'/* A tabela rola de lado no telefone, com o cabecalho colado a esquerda. */
.pl-tab td { padding: 4px; }' 0

caso "pedido curto nao serve de base" "$PEDIDO_CURTO" \
'/* usei cards em vez de tabela aqui */' 0

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     outra ferramenta passa" || { echo "  FALHOU outra ferramenta"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
