#!/usr/bin/env bash
# Andaime compartilhado dos testes de trava (CC-137).
#
# Catorze travas estavam sem teste em 18/08, e o motivo era o custo: cada uma
# precisa de um transcrito de conversa falso, e escrever isso à mão em catorze
# arquivos garante que ninguém escreva nenhum. Aqui o transcrito é montado por
# uma função, e o teste de cada trava vira uma lista de casos.
#
# NÃO É `testar-<id>.sh`: este arquivo não corresponde a trava nenhuma, e o
# painel só procura o nome com id. Use com `source`.
#
# O que uma trava recebe: um JSON no stdin com `transcript_path`, e às vezes
# `cwd` e `session_id`. O que ela responde: 0 passa, 2 barra.

set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$RAIZ/hooks"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

# A casa de teste isola config e estado: trava que lê o interruptor global não
# pode depender do que está ligado na máquina de quem roda, e escrever no
# `~/.claude` de verdade é o defeito que já apagou as notas dele uma vez.
export CC_HOME="$T/casa"
mkdir -p "$CC_HOME"

# Monta um transcrito .jsonl. Recebe o caminho e depois pares de linhas:
#   u "texto"      uma mensagem dele
#   t Nome '{...}' uma chamada de ferramenta
#   a "texto"      uma resposta minha
transcrito() {
  local alvo="$1"; shift
  : > "$alvo"
  while [ $# -gt 0 ]; do
    case "$1" in
      u) node -e 'process.stdout.write(JSON.stringify({type:"user",message:{content:process.argv[1]},timestamp:new Date().toISOString()})+"\n")' "$2" >> "$alvo"; shift 2 ;;
      a) node -e 'process.stdout.write(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:process.argv[1]}]},timestamp:new Date().toISOString()})+"\n")' "$2" >> "$alvo"; shift 2 ;;
      t) node -e 'process.stdout.write(JSON.stringify({type:"assistant",message:{content:[{type:"tool_use",name:process.argv[1],input:JSON.parse(process.argv[2])}]},timestamp:new Date().toISOString()})+"\n")' "$2" "$3" >> "$alvo"; shift 3 ;;
      r) node -e 'process.stdout.write(JSON.stringify({type:"user",toolUseResult:{stdout:process.argv[1]},message:{content:[{type:"tool_result",content:process.argv[1]}]},timestamp:new Date().toISOString()})+"\n")' "$2" >> "$alvo"; shift 2 ;;
      *) echo "linha desconhecida: $1"; exit 1 ;;
    esac
  done
}

# Roda uma trava contra um transcrito e confere o código de saída.
#   prova <nome do caso> <id da trava> <esperado 0|2> <arquivo> [json extra]
prova() {
  local nome="$1" id="$2" esperado="$3" tr="$4" extra="${5:-{\}}"
  local entrada
  entrada=$(node -e '
    const extra = JSON.parse(process.argv[2] || "{}")
    process.stdout.write(JSON.stringify({ transcript_path: process.argv[1], ...extra }))
  ' "$tr" "$extra")
  local saida codigo
  saida=$(echo "$entrada" | node "$(caminho "$id")" 2>&1)
  codigo=$?
  if [ "$codigo" = "$esperado" ]; then
    echo "  ok     $nome"
  else
    echo "  FALHOU $nome (saiu $codigo, esperava $esperado)"
    echo "$saida" | head -4 | sed 's/^/         /'
    FALHOU=1
  fi
}

# Nem toda trava barra: algumas só avisam e saem com 0 (o aviso de roadmap, os
# dois do Routia, os de estilo). Nessas o que se mede é o TEXTO.
#   diz <nome do caso> <id> <sim|nao> <trecho esperado> <json de entrada>
diz() {
  local nome="$1" id="$2" quer="$3" trecho="$4" entrada="$5"
  local saida
  saida=$(echo "$entrada" | node "$(caminho "$id")" 2>&1)
  local achou=nao
  echo "$saida" | grep -qiF "$trecho" && achou=sim
  if [ "$achou" = "$quer" ]; then
    echo "  ok     $nome"
  else
    echo "  FALHOU $nome (esperava $quer para \"$trecho\")"
    echo "$saida" | head -4 | sed 's/^/         /'
    FALHOU=1
  fi
}

caminho() {
  if [ -f "$HOOKS/$1.mjs" ]; then echo "$HOOKS/$1.mjs"; else echo "$HOOKS/routia/$1.mjs"; fi
}

# As duas verificações que TODA trava precisa passar, e que já pegaram defeito
# real aqui: entrada vazia não pode travar por erro próprio, e a segunda volta
# tem que passar, senão o laço nunca fecha e a sessão fica presa.
higiene() {
  local id="$1"
  echo '{}' | node "$(caminho "$id")" > /dev/null 2>&1
  [ $? = 0 ] && echo "  ok     entrada vazia não trava" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
  echo '{"stop_hook_active":true}' | node "$(caminho "$id")" > /dev/null 2>&1
  [ $? = 0 ] && echo "  ok     a segunda volta passa" || { echo "  FALHOU segunda volta"; FALHOU=1; }
}
