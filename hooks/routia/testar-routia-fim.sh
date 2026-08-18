#!/usr/bin/env bash
# Os casos do routia-fim (CC-137, 18/08).
#
# Ela lembra, no fim do turno, de liberar a rota que a sessão marcou. E é o
# ÚNICO momento em que o dono de uma rota é alcançado por outra sessão: não
# existe canal direto entre sessões do Claude Code, então um pedido de
# autorização pendente aparece aqui ou não aparece em lugar nenhum.
#
# ⚠️ Um defeito foi achado ao escrever este arquivo: a confirmação de "estou
# sozinho no projeto" procurava o `cc.mjs` num caminho fixo do Windows, e fora
# dali nunca confirmava nada, avisando toda vez. Ver `acharCC.mjs`.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$RAIZ/hooks/routia/routia-fim.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

echo "== routia-fim =="

MINHA=abcd1234
OUTRA=beef5678

quadro() { # $1 = projeto, resto = linhas
  local dir="$T/$1"; mkdir -p "$dir/docs"; shift
  printf '%s\n' "$@" > "$dir/docs/ROTAS-ATIVAS.md"
  echo "$dir"
}

COM_A_MINHA=$(quadro p1 "# Rotas ativas" "" "| Rota | Status | Quem | Desde |" "|---|---|---|---|" \
  "| \`cockpit\` | 🔴 ocupada | $MINHA — a entrevista na tela | hoje |")
SO_DA_OUTRA=$(quadro p2 "# Rotas ativas" "" "| Rota | Status | Quem | Desde |" "|---|---|---|---|" \
  "| \`cockpit\` | 🔴 ocupada | $OUTRA — outra coisa | hoje |")
TODAS_LIVRES=$(quadro p3 "# Rotas ativas" "" "| Rota | Status | Quem | Desde |" "|---|---|---|---|" \
  "| \`cockpit\` | 🟢 livre | — | — |")
SEM_QUADRO="$T/p4"; mkdir -p "$SEM_QUADRO"

# O `cc json` de mentira. Antes o teste apontava `CC_CLI` para um arquivo
# inexistente, e isso NÃO controla nada: candidato que não existe é descartado, e
# a busca cai no `cc.mjs` de verdade — o teste passou a consultar os agentes
# reais da máquina e virou não-determinístico. Um dublê que existe e responde o
# que o caso precisa é o único jeito de medir a decisão da trava.
duble() { # $1 = json que o `cc json` deve devolver
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1],
  `const dados = ${process.argv[2]}\nprocess.stdout.write(JSON.stringify(dados))\n`)
' "$T/cc-duble.mjs" "$1"
}

# Por padrão: existe outro agente trabalhando no mesmo projeto. É o caso em que
# lembrar da rota importa, porque alguém está esperando por ela.
duble "{ jobs: [{ id: '$OUTRA', cwd: '$COM_A_MINHA', status: 'working' }] }"

fala() { # nome, quer(sim|nao), trecho, cwd, sessao
  local saida achou=nao
  saida=$(echo "{\"cwd\":\"$4\",\"session_id\":\"$5-0000\"}" | CC_CLI="$T/cc-duble.mjs" node "$HOOK" 2>&1)
  echo "$saida" | grep -qiF "$3" && achou=sim
  if [ "$achou" = "$2" ]; then echo "  ok     $1"; else
    echo "  FALHOU $1 (esperava $2 para \"$3\")"; echo "$saida" | head -3 | sed 's/^/         /'; FALHOU=1
  fi
}

echo "— o que precisa lembrar —"
fala "lembra da rota que ESTA sessao marcou" sim "cockpit" "$COM_A_MINHA" "$MINHA"

echo "— o que tem que ficar calado —"
fala "rota de outra sessao nao e problema meu" nao "cockpit" "$SO_DA_OUTRA" "$MINHA"
fala "nenhuma rota marcada por mim" nao "cockpit" "$TODAS_LIVRES" "$MINHA"
fala "projeto sem quadro: o metodo e opt-in" nao "rota" "$SEM_QUADRO" "$MINHA"

echo "— quando da para confirmar que estou sozinho —"
duble "{ jobs: [{ id: '$MINHA', cwd: '$COM_A_MINHA', status: 'working' }] }"
fala "sozinho no projeto: nao ha a quem a rota atrapalhe" nao "cockpit" "$COM_A_MINHA" "$MINHA"
duble "{ jobs: [{ id: '$OUTRA', cwd: '/outro/projeto', status: 'working' }] }"
fala "o outro agente esta em OUTRO projeto, nao conta" nao "cockpit" "$COM_A_MINHA" "$MINHA"
duble "{ jobs: [{ id: '$OUTRA', cwd: '$COM_A_MINHA', status: 'done' }] }"
fala "o outro agente ja terminou, nao conta" nao "cockpit" "$COM_A_MINHA" "$MINHA"

# Voltar ao padrão: outro agente ativo no mesmo projeto.
duble "{ jobs: [{ id: '$OUTRA', cwd: '$COM_A_MINHA', status: 'working' }] }"

echo "— pedido de autorizacao pendente —"
mkdir -p "$COM_A_MINHA/docs"
node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], JSON.stringify({ pedidos: [{
  id: "p1", de: "cafe0000", arquivo: "src/ui.html", rota: "cockpit",
  status: "pendente", tentativas: 2, em: Date.now(),
}] }))
' "$COM_A_MINHA/docs/.rotas-pedidos.json"
fala "avisa quem esta travado esperando resposta" sim "cafe0000" "$COM_A_MINHA" "$MINHA"
fala "e diz o comando de autorizar, nao so que existe pedido" sim "autorizar" "$COM_A_MINHA" "$MINHA"

echo "— higiene —"
echo '{}' | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo "{\"cwd\":\"$COM_A_MINHA\",\"session_id\":\"$MINHA-0\",\"stop_hook_active\":true}" | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     nao insiste na segunda volta" || { echo "  FALHOU segunda volta"; FALHOU=1; }
saida=$(echo "{\"cwd\":\"$COM_A_MINHA\",\"session_id\":\"$MINHA-0\"}" | node "$HOOK" 2>&1); codigo=$?
[ "$codigo" = 0 ] && echo "  ok     avisa sem barrar o fim do turno" || { echo "  FALHOU saiu $codigo"; FALHOU=1; }

exit $FALHOU
