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

# 19/08: o "sim" que responde a uma pergunta minha. A trava barrou um commit
# que ele tinha autorizado com todas as letras, e o pior e que a propria
# mensagem de recusa manda perguntar, e depois nao aceitava a resposta.
#
# Aqui a ordem do arquivo importa e e o contrario da funcao `turno`: EU
# pergunto primeiro, ele responde depois.
pergunta_e_sim() { # arquivo, minha pergunta, resposta dele
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[2], [
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: process.argv[3] }] } }),
  JSON.stringify({ type: "user", message: { content: process.argv[4] } }),
].join("\n"))
' x "$1" "$2" "$3"
}

caso_pergunta() { # nome, minha pergunta, resposta dele, exit esperado
  local tr="$T/p.jsonl"
  pergunta_e_sim "$tr" "$2" "$3"
  node -e '
process.stdout.write(JSON.stringify({
  tool_name: "Bash", transcript_path: process.argv[2],
  tool_input: { command: "git commit -m \"x\"" },
}))' x "$tr" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

echo "— o sim que responde a uma pergunta minha (19/08) —"
caso_pergunta "eu perguntei se podia commitar, ele disse sim" \
  "Gate verde. Posso commitar e enviar?" "sim" 0
caso_pergunta "o mesmo sim, escrito como ele escreve" \
  "Posso commitar?" "pode" 0
caso_pergunta "sim SEM eu ter perguntado nada sobre commit: continua barrando" \
  "Terminei de arrumar o alinhamento da tabela. Ficou bom assim?" "sim" 2
caso_pergunta "eu falei de commit mas NAO perguntei: continua barrando" \
  "O ultimo commit foi ontem." "sim" 2
caso_pergunta "resposta longa nao e o sim curto: continua barrando" \
  "Posso commitar?" "sim, mas antes muda o titulo da tabela" 2

# O caso que derrubou a PRIMEIRA versao deste conserto, na primeira tentativa
# real: a trava barra, eu escrevo alguma coisa, e essa fala vira a minha mais
# recente, enterrando a pergunta que ele respondeu. A fronteira e o sim dele.
turno_com_fala_depois() { # arquivo: eu pergunto, ele diz sim, eu falo de novo
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[2], [
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Gate verde. Posso commitar e enviar?" }] } }),
  JSON.stringify({ type: "user", message: { content: "sim" } }),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Agora o commit que voce autorizou." }] } }),
].join("\n"))
' x "$1"
}
turno_com_fala_depois "$T/d.jsonl"
node -e '
process.stdout.write(JSON.stringify({
  tool_name: "Bash", transcript_path: process.argv[2],
  tool_input: { command: "git commit -m \"x\"" },
}))' x "$T/d.jsonl" | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     minha fala DEPOIS do sim nao enterra a pergunta" \
  || { echo "  FALHOU minha fala depois do sim enterrou a pergunta"; FALHOU=1; }

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"tool_name":"Edit","tool_input":{"file_path":"/x"}}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     outra ferramenta passa" || { echo "  FALHOU outra ferramenta"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
