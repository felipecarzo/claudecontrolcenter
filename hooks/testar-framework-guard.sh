#!/bin/bash
# Testa o gate de MVP de ponta a ponta, chamando o hook do mesmo jeito que o
# Claude Code chama: JSON no stdin, codigo de saida importa.
#
#   exit 0 = liberou    exit 2 = bloqueou
#
# O projeto de teste e montado numa pasta temporaria, nunca contra o repositorio
# de verdade: rodar hook a mao contra o proprio projeto ja gravou lixo real aqui
# em 14/08 (um pedido de sessao falsa no .rotas-pedidos.json do Routia).
set -u
HOOK="$(cd "$(dirname "$0")" && pwd)/framework-guard.mjs"
BASE=$(mktemp -d 2>/dev/null) || BASE="${TMPDIR:-/tmp}/framework-guard-$$"
PROJ="$BASE/projeto"
LIMPO="$BASE/sem-framework"
mkdir -p "$PROJ/.framework" "$PROJ/src" "$PROJ/docs" "$LIMPO/src"
limpar() { rm -rf "$BASE"; }
trap limpar EXIT

falhas=0
caso() { # $1 = nome, $2 = esperado (libera|bloqueia), $3 = caminho do arquivo
  local saida codigo obtido
  saida=$(echo "{\"session_id\":\"t\",\"tool_input\":{\"file_path\":\"$3\"}}" | node "$HOOK" 2>&1)
  codigo=$?
  obtido="libera"; [ $codigo -eq 2 ] && obtido="bloqueia"
  if [ "$obtido" = "$2" ]; then echo "  ok    $1"
  else echo "  FALHA $1 (esperado $2, veio $obtido)"; echo "$saida" | head -3; falhas=$((falhas+1)); fi
}
conter() { # $1 = nome, $2 = caminho, $3 = trecho esperado no texto da recusa
  local saida
  saida=$(echo "{\"session_id\":\"t\",\"tool_input\":{\"file_path\":\"$2\"}}" | node "$HOOK" 2>&1)
  case "$saida" in *"$3"*) echo "  ok    $1";; *) echo "  FALHA $1"; falhas=$((falhas+1));; esac
}

escrever_estado() { printf '%s\n' "$1" > "$PROJ/.framework/estado.json"; }

echo "== gate de MVP =="

echo "1. projeto sem framework nao e afetado"
caso "sem .framework passa livre" libera "$LIMPO/src/a.mjs"

echo "2. fase de definicao, sem MVP"
escrever_estado '{"metodo":"mvp-basico","fase":"definicao","mvp":{"nome":"","criterios":[]}}'
caso "codigo e bloqueado" bloqueia "$PROJ/src/a.mjs"
conter "a recusa diz o que falta" "$PROJ/src/a.mjs" "criterio"
conter "a recusa diz como sair" "$PROJ/src/a.mjs" "Como sair daqui"
caso "docs continua livre" libera "$PROJ/docs/HANDOFF.md"
caso "o proprio estado continua livre" libera "$PROJ/.framework/estado.json"
caso "arquivo de raiz continua livre" libera "$PROJ/package.json"

echo "3. MVP definido abre o portao"
escrever_estado '{"metodo":"mvp-basico","fase":"definicao","mvp":{"nome":"painel","criterios":[{"texto":"uma linha por agente","feito":false}]}}'
caso "codigo libera" libera "$PROJ/src/a.mjs"

echo "4. desligado pelo botao do painel"
escrever_estado '{"metodo":"mvp-basico","fase":"definicao","ligado":false,"mvp":{"nome":"","criterios":[]}}'
caso "desligado nao trava codigo" libera "$PROJ/src/a.mjs"
escrever_estado '{"metodo":"mvp-basico","fase":"definicao","ligado":true,"mvp":{"nome":"","criterios":[]}}'
caso "religado volta a travar" bloqueia "$PROJ/src/a.mjs"

echo "5. estado quebrado nao pode travar ninguem"
printf 'isto nao e json\n' > "$PROJ/.framework/estado.json"
caso "json invalido libera" libera "$PROJ/src/a.mjs"
escrever_estado '{"metodo":"metodo-que-nao-existe","fase":"x"}'
caso "metodo desconhecido libera" libera "$PROJ/src/a.mjs"

echo "5b. os modos"
escrever_estado '{"metodo":"mvp-basico","fase":"execucao","ligado":true,"modo":"imperativo","mvp":{"nome":"x","criterios":[{"texto":"a","feito":true}]}}'
caso "imperativo trava mesmo com MVP pronto" bloqueia "$PROJ/src/a.mjs"
conter "a recusa fala de autorizacao, nao de MVP" "$PROJ/src/a.mjs" "autoriza"
caso "imperativo nao trava docs" libera "$PROJ/docs/x.md"
escrever_estado '{"metodo":"mvp-basico","fase":"execucao","ligado":true,"modo":"imperativo","autorizado":["**"],"mvp":{"nome":"x","criterios":[{"texto":"a","feito":true}]}}'
caso "autorizado libera" libera "$PROJ/src/a.mjs"
escrever_estado '{"metodo":"mvp-basico","fase":"execucao","ligado":true,"modo":"dialogo","mvp":{"nome":"x","criterios":[{"texto":"a","feito":true}]}}'
caso "dialogo nao trava" libera "$PROJ/src/a.mjs"

echo "6. entrada malformada nao pode travar ninguem"
caso "sem file_path" libera ""
echo "" | node "$HOOK" >/dev/null 2>&1
[ $? -eq 0 ] && echo "  ok    stdin vazio libera" || { echo "  FALHA stdin vazio"; falhas=$((falhas+1)); }

echo
[ $falhas -eq 0 ] && echo "TUDO PASSOU" || echo "$falhas FALHA(S)"
exit $falhas
