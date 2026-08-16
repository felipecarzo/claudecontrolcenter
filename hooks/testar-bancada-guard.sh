#!/usr/bin/env bash
# Os casos do bancada-guard (16/08): a tarefa se auto-verifica antes de entregar.
#
# Roda num projeto de mentira, com framework ligado e nível declarado. O que
# importa provar, em ordem:
#   1. mexeu em código e a Bancada nunca rodou → devolve;
#   2. rodou ANTES da edição não conta — é cobertura de um estado que já morreu;
#   3. rodou depois → passa;
#   4. só documentação → nunca cobra;
#   5. projeto com framework desligado → nunca cobra (a Bancada é opt-in).
set -u
H="$HOME/projetos/proj_controlcenter/hooks/bancada-guard.mjs"
T=$(mktemp -d)
mkdir -p "$T/.framework" "$T/src" "$T/docs"
: > "$T/src/app.mjs"
: > "$T/docs/nota.md"

# $1 quando a camada `segredo` rodou (ISO), ou "nunca"  $2 ligado  -> escreve o estado
estado() {
  local ver="{}"
  [ "$1" != "nunca" ] && ver="{\"segredo\":{\"ok\":true,\"em\":\"$1\"}}"
  cat > "$T/.framework/estado.json" <<EOF
{"metodo":"mvp-basico","fase":"execucao","ligado":$2,"modo":"restritivo",
 "nivelBancada":"rascunho","verificacao":$ver}
EOF
}

# $1 nome  $2 arquivo editado  $3 esperado
caso() {
  local tr="$T/t.jsonl"
  node -e '
const fs=require("fs")
fs.writeFileSync(process.argv[1],[
 JSON.stringify({type:"user",message:{content:"vai"}}),
 JSON.stringify({type:"assistant",message:{content:[{type:"tool_use",name:"Edit",input:{file_path:process.argv[2]}}]}}),
].join("\n"))' "$tr" "$T/$2"
  echo "{\"transcript_path\":\"$tr\",\"cwd\":\"$T\"}" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

echo "— framework ligado, nível rascunho —"
estado nunca true
caso "editou codigo, bancada nunca rodou"  src/app.mjs  2

estado "2000-01-01T00:00:00.000Z" true
caso "bancada rodou ANTES da edicao"       src/app.mjs  2

touch -d "2000-01-01" "$T/src/app.mjs" 2>/dev/null || touch -t 200001010000 "$T/src/app.mjs"
estado "2030-01-01T00:00:00.000Z" true
caso "bancada rodou DEPOIS da edicao"      src/app.mjs  0

estado nunca true
caso "so documentacao nao cobra"           docs/nota.md 0

echo "— framework desligado: a Bancada e opt-in —"
estado nunca false
caso "projeto com framework desligado"     src/app.mjs  0

rm -rf "$T"
