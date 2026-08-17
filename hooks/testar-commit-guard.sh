#!/usr/bin/env bash
# Os casos do commit-guard.
#
# A regra é dele, do arquivo global de instruções: "Nunca commitar sem que eu
# peça explicitamente". A trava existe porque instrução escrita não me segura.
#
# Os textos de autorização são os DELE, escritos com pressa no celular: "comit",
# "commita", "sobe isso". Aceitar erro de digitação é de propósito, porque exigir
# a palavra certa faria a trava barrar um sim que ele deu.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/commit-guard.mjs"
T=$(mktemp -d)
FALHOU=0

turno() { # arquivo, ultima mensagem dele
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[2], [
  JSON.stringify({ type: "user", message: { content: process.argv[3] } }),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "ok" }] } }),
].join("\n"))
' x "$1" "$2"
}

caso() { # nome, mensagem dele, comando, exit esperado
  local tr="$T/t.jsonl"
  turno "$tr" "$2"
  node -e '
process.stdout.write(JSON.stringify({
  tool_name: "Bash", transcript_path: process.argv[2],
  tool_input: { command: process.argv[3] },
}))' x "$tr" "$3" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

echo "— o que precisa barrar —"
caso "commit sem ele ter pedido"        "arruma o alinhamento do cartao" \
  'git commit -m "fix(ui): alinhamento"' 2
caso "commit depois de um elogio"       "ficou otimo, muito melhor agora" \
  'git commit -am "wip"' 2
caso "commit no meio de outro assunto"  "e o design que eu pedi?" \
  'cd /x && git commit -m "x"' 2

echo "— o que tem que passar (ele pediu) —"
caso "comit, do jeito que ele digita"   "comit"                    'git commit -m "x"' 0
caso "commita"                          "beleza, commita isso ai"  'git commit -m "x"' 0
caso "sobe isso"                        "sobe isso pro git"        'git commit -m "x"' 0
caso "pediu push"                       "faz push"                 'git commit -m "x" && git push' 0
caso "rotina de encerramento"           "/end-session"             'git commit -m "docs(session): x"' 0

echo "— o que nao e assunto desta trava —"
caso "outro comando de git"             "arruma o alinhamento"     'git status' 0
caso "amend de commit ja autorizado"    "arruma o alinhamento"     'git commit --amend -m "x"' 0

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"tool_name":"Edit","tool_input":{"file_path":"/x"}}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     outra ferramenta passa" || { echo "  FALHOU outra ferramenta"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
