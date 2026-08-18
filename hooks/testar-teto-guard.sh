#!/usr/bin/env bash
# Os casos do teto-guard (CC-137, 18/08).
#
# O teto é DUAS entregas por vez. Palavras dele em 16/08, depois de eu fechar
# nove tarefas de uma vez: "o meu cérebro não consegue absorver tudo (…) eu
# acabo virando uma pessoa dependente, quando dá um problema eu nem sei qual o
# problema que está dando".
#
# A conta é só do que fechou DEPOIS da última fala dele: o que ele já viu não
# conta de novo, senão a cobrança viraria permanente.
#
# O modo autônomo não tem teto de propósito, e esse caso está aqui porque é a
# diferença entre uma trava e uma camisa de força.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== teto-guard =="

SESSAO=aaaabbbb-cccc-dddd
AGORA=$(node -e 'process.stdout.write(String(Date.now()))')
ANTES=$(node -e 'process.stdout.write(new Date(Number(process.argv[1]) - 600000).toISOString())' "$AGORA")
DEPOIS=$(node -e 'process.stdout.write(new Date(Number(process.argv[1]) + 60000).toISOString())' "$AGORA")

# O transcrito precisa carregar o horário da fala dele: é dele que a conta parte.
falou_e_trabalhei() {
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], [
  JSON.stringify({ type: "user", message: { content: "toca o backlog" }, timestamp: process.argv[2] }),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Feito." }] } }),
].join("\n"))
' "$1" "$2"
}
falou_e_trabalhei "$T/t.jsonl" "$ANTES"

# As tarefas fechadas ficam na meta da sessão, com o carimbo de quando fecharam.
meta() { # $1 = quantas fechadas depois da fala dele
  mkdir -p "$CC_HOME/control-center-sessoes"
  node -e '
const fs = require("fs")
const [alvo, n, depois] = process.argv.slice(1)
const feitoEm = {}
for (let i = 1; i <= Number(n); i += 1) feitoEm[`a tarefa numero ${i} desta rodada`] = depois
fs.writeFileSync(alvo, JSON.stringify({ subject: "o backlog", feitoEm }, null, 1))
' "$CC_HOME/control-center-sessoes/$SESSAO.json" "$1" "$DEPOIS"
}

caso() { # nome, esperado, cwd extra
  local saida codigo
  # `CLAUDE_CODE_SESSION_ID` precisa ser o da sessão de MENTIRA. A trava lê a
  # variável de ambiente antes do payload, e é o certo em produção; num teste
  # rodado de dentro de uma sessão de verdade, herdar o ambiente faz a trava
  # medir a sessão de quem está testando. Custou uma investigação em 18/08.
  saida=$(echo "{\"transcript_path\":\"$T/t.jsonl\",\"session_id\":\"$SESSAO\",\"cwd\":\"${3:-$T}\"}" \
    | CC_HOME="$CC_HOME" CLAUDE_CODE_SESSION_ID="$SESSAO" node "$(caminho teto-guard)" 2>&1)
  codigo=$?
  if [ "$codigo" = "$2" ]; then echo "  ok     $1"; else
    echo "  FALHOU $1 (saiu $codigo, esperava $2)"; echo "$saida" | head -3 | sed 's/^/         /'; FALHOU=1
  fi
}

echo "— o que precisa barrar —"
meta 5; caso "cinco entregas sem ele ver" 2
meta 3; caso "tres ja passa do teto de duas" 2

echo "— o que tem que passar —"
meta 2; caso "duas e o teto, nao o excesso" 0
meta 0; caso "nada fechado nesta rodada" 0

# Tudo que fechou ANTES da fala dele já foi visto e não pode ser cobrado de novo.
mkdir -p "$CC_HOME/control-center-sessoes"
node -e '
const fs = require("fs")
const [alvo, antes] = process.argv.slice(1)
const feitoEm = {}
for (let i = 1; i <= 9; i += 1) feitoEm[`tarefa velha ${i}`] = antes
fs.writeFileSync(alvo, JSON.stringify({ subject: "o backlog", feitoEm }, null, 1))
' "$CC_HOME/control-center-sessoes/$SESSAO.json" \
  "$(node -e 'process.stdout.write(new Date(Number(process.argv[1]) - 3600000).toISOString())' "$AGORA")"
caso "nove entregas que ele JA viu nao contam de novo" 0

echo "— o modo autonomo nao tem teto, de proposito —"
AUT="$T/autonomo"; mkdir -p "$AUT/.framework"
node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], JSON.stringify({
  metodo: "mvp-basico", modo: "continuo", fase: "execucao", ligado: true,
  mvp: { nome: "x", criterios: [] }, ferramentas: [], verificacao: {}, autorizado: [], historico: [],
}, null, 1))
' "$AUT/.framework/estado.json"
meta 9; caso "nove entregas no modo autonomo" 0 "$AUT"

echo "— higiene —"
higiene teto-guard

exit $FALHOU
