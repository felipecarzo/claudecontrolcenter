#!/usr/bin/env bash
# Os casos do tarefa-vaga-guard (17/08, CC-126).
#
# Os textos NÃO são inventados: são tarefas reais desta máquina, as mesmas 29
# que serviram para escolher o discriminador. A que ele citou como ruim
# ("profissao escolhe quem entra") tem que barrar; as que ele leu sem reclamar
# têm que passar.
#
# Casa isolada por CC_HOME: teste que escreve em dado real do Felipe é defeito.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/tarefa-vaga-guard.mjs"
T=$(mktemp -d)
export CC_HOME="$T/casa"
mkdir -p "$CC_HOME/control-center-sessoes"
SID="vaga0000-0000-0000-0000-000000000000"
FALHOU=0

caso() { # nome, texto da tarefa, exit esperado
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[2], JSON.stringify({todos:[{text:process.argv[3],done:false}]}))
' x "$CC_HOME/control-center-sessoes/$SID.json" "$2"
  echo "{\"session_id\":\"$SID\"}" | CLAUDE_CODE_SESSION_ID="$SID" node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $3)"; FALHOU=1; }
}

echo "— o que precisa barrar (telegrama) —"
caso "a que ele citou como ruim"        "ESC-132 profissao escolhe quem entra" 2
caso "duas palavras soltas"             "ESC-130 elenco em disco" 2
caso "titulo de commit"                 "corrigir layout mobile" 2

echo "— o que tem que passar (frase inteira) —"
caso "a versao que ele quer"            "a profissao do agente define se ele entra na tarefa" 0
caso "tarefa real clara"                "cada entrega diz se precisa do seu olho" 0
caso "tarefa real com projeto"          "modo continuo criado e ligado neste projeto" 0
caso "tarefa real com codigo no comeco" "ESC-133 tela de cadastro no celular" 0

echo "— o guarda nao pode travar por bug proprio —"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({todos:[]}))' \
  "$CC_HOME/control-center-sessoes/$SID.json"
echo "{\"session_id\":\"$SID\"}" | CLAUDE_CODE_SESSION_ID="$SID" node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     cartao sem tarefa" || { echo "  FALHOU cartao sem tarefa"; FALHOU=1; }
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
