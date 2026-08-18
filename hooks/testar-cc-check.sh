#!/usr/bin/env bash
# Os casos da trava "to-do aberto trava a entrega" (CC-137, 18/08).
#
# O id no catálogo é `cc-check`, e quem a implementa é `hooks/routia/todo-guard.mjs`:
# ela chama `cc check` e devolve o que ele reclamar.
#
# Por que existe: em 2026-08-08, cinco jobs entregues tinham 0 de 34 tarefas
# marcadas. Lista em aberto num agente entregue é métrica perdida.
#
# ⚠️ O primeiro caso deste arquivo nasceu de um defeito ACHADO por ele: o hook
# procurava o `cc.mjs` num caminho fixo do npm global do Windows, então em Linux
# e em Mac ele liberava sempre, calado. A trava estava desligada de fato em toda
# máquina que não fosse o PC dele.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$RAIZ/hooks/routia/todo-guard.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

echo "== cc-check (to-do aberto trava a entrega) =="

# Um job de mentira, com o meta.json que o agente escreve.
job() { # $1 = nome, $2 = json do meta
  local dir="$T/jobs/$1"
  mkdir -p "$dir"
  printf '%s' "$2" > "$dir/meta.json"
  printf '{"state":"done"}' > "$dir/state.json"
  echo "$dir"
}

ENTREGUE_COM_ABERTO=$(job a1 '{"status":"entregue","subject":"a entrevista na tela","todos":[{"text":"a rota que entrega a pergunta","done":true},{"text":"a tela com a pergunta da vez","done":false}]}')
# O mesmo caso com o status em inglês. O protocolo dá o exemplo em português,
# mas nada obriga o agente a copiá-lo, e uma trava que depende do idioma
# escolhido não é trava: em 18/08 uma sessão inteira reportou "done" e nunca
# teria sido cobrada.
EM_INGLES=$(job a4 '{"status":"done","subject":"a entrevista na tela","todos":[{"text":"a tela com a pergunta da vez","done":false}]}')
ENTREGUE_LIMPO=$(job a2 '{"status":"done","subject":"a entrevista na tela","todos":[{"text":"a rota que entrega a pergunta","done":true}]}')
TRABALHANDO=$(job a3 '{"status":"working","subject":"a entrevista na tela","todos":[{"text":"a tela com a pergunta da vez","done":false}]}')

caso() { # nome, esperado, dir do job
  local saida codigo
  # CC_HOME aponta para a casa de teste, e é ela que faz a pasta de jobs ser a
  # de mentira: escrever no `~/.claude/jobs` de verdade é o que este projeto
  # promete nunca fazer.
  saida=$(echo '{}' | CLAUDE_JOB_DIR="$3" CC_HOME="$T" node "$HOOK" 2>&1)
  codigo=$?
  if [ "$codigo" = "$2" ]; then
    echo "  ok     $1"
  else
    echo "  FALHOU $1 (saiu $codigo, esperava $2)"
    echo "$saida" | head -3 | sed 's/^/         /'
    FALHOU=1
  fi
}

echo "— o que precisa barrar —"
caso "disse que entregou com uma tarefa aberta" 2 "$ENTREGUE_COM_ABERTO"
caso "o mesmo, com o status escrito em ingles" 2 "$EM_INGLES"

echo "— o que tem que passar —"
caso "entregou com a lista toda fechada" 0 "$ENTREGUE_LIMPO"
caso "ainda trabalhando: a lista aberta e o normal" 0 "$TRABALHANDO"

echo "— higiene —"
echo '{}' | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     fora de job nao trava nada" || { echo "  FALHOU fora de job"; FALHOU=1; }
echo '{"stop_hook_active":true}' | CLAUDE_JOB_DIR="$ENTREGUE_COM_ABERTO" node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     a segunda volta passa" || { echo "  FALHOU segunda volta"; FALHOU=1; }
echo '{}' | CLAUDE_JOB_DIR="$ENTREGUE_COM_ABERTO" CC_CLI="$T/nao-existe.mjs" node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     sem o cc na maquina, libera em vez de quebrar" || { echo "  FALHOU falha aberta"; FALHOU=1; }

exit $FALHOU
