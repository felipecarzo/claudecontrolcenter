#!/usr/bin/env bash
# Os casos da trava por arquivo do rota-guard (16/08).
#
# O que se prova aqui, em ordem de importância:
#   1. rota de OUTRA sessão que declara o arquivo BARRA quem tem rota própria
#      — é o conserto inteiro, e o que não existia antes;
#   2. rota SEM 📁 não barra ninguém, então todo quadro antigo segue igual;
#   3. o dono do arquivo continua passando;
#   4. prefixo de pasta (`📁 src/`) cobre o que está dentro dela.
#
# Roda num quadro de mentira, em pasta temporária: mexer no quadro de verdade
# durante o teste deixaria rota fantasma se o script fosse interrompido.
set -u
GUARD="$HOME/.claude/hooks/rota-guard.mjs"
T=$(mktemp -d)
mkdir -p "$T/docs" "$T/src"
: > "$T/src/ui.html"
: > "$T/src/bancada.mjs"
: > "$T/src/web.mjs"

quadro() {
  cat > "$T/docs/ROTAS-ATIVAS.md" <<QUADRO
---
tipo: quadro
pastas-controladas: [src]
---
# Rotas ativas

| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
$1
QUADRO
}

# $1 nome  $2 sessão  $3 arquivo  $4 saída esperada
caso() {
  local saida
  echo "{\"session_id\":\"$2-0000-0000\",\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$T/$3\"}}" \
    | node "$GUARD" > /dev/null 2>&1
  saida=$?
  if [ "$saida" = "$4" ]; then echo "  ok     $1"; else echo "  FALHOU $1 (saiu $saida, esperava $4)"; fi
}

echo "— rota que declara arquivos (📁) —"
quadro "| \`front\` | 🔴 ocupada | aaaaaaaa — telas 📁 src/ui.html | hoje |
| \`motor\` | 🔴 ocupada | bbbbbbbb — nucleo 📁 src/bancada.mjs | hoje |"
caso "dono edita o proprio arquivo"        aaaaaaaa src/ui.html      0
caso "outra rota NAO pega o arquivo alheio" bbbbbbbb src/ui.html      2
caso "cada um no seu"                       bbbbbbbb src/bancada.mjs  0
caso "arquivo de ninguem, com rota marcada" aaaaaaaa src/web.mjs      0
caso "sem rota nenhuma continua barrado"    cccccccc src/web.mjs      2

echo "— quadro antigo, sem 📁: nada pode mudar —"
quadro "| \`front\` | 🔴 ocupada | aaaaaaaa — telas | hoje |
| \`motor\` | 🔴 ocupada | bbbbbbbb — nucleo | hoje |"
caso "sem 📁 ninguem reivindica nada"       bbbbbbbb src/ui.html      0
caso "sem rota continua barrado"            cccccccc src/ui.html      2

echo "— 📁 com pasta cobre o que esta dentro —"
quadro "| \`front\` | 🔴 ocupada | aaaaaaaa — tudo de src 📁 src/ | hoje |
| \`motor\` | 🔴 ocupada | bbbbbbbb — nucleo | hoje |"
caso "pasta reivindicada barra o vizinho"   bbbbbbbb src/bancada.mjs  2
caso "e libera o dono"                      aaaaaaaa src/bancada.mjs  0

echo "— rota livre nao reivindica —"
quadro "| \`front\` | 🟢 livre | — (aaaaaaaa fechou: 📁 src/ui.html) | — |
| \`motor\` | 🔴 ocupada | bbbbbbbb — nucleo | hoje |"
caso "rota fechada nao segura o arquivo"    bbbbbbbb src/ui.html      0

echo "— documentacao nunca e barrada —"
quadro "| \`front\` | 🔴 ocupada | aaaaaaaa — telas 📁 src/ui.html | hoje |"
mkdir -p "$T/docs" && : > "$T/docs/nota.md"
caso "docs passa mesmo sem rota"            cccccccc docs/nota.md     0

rm -rf "$T"
