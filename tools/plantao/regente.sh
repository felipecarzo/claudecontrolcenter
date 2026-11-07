#!/bin/bash
# CC-1068: o timer chama isto de 10 em 10 min. Para cada projeto com o Regente ligado e sem arquiteto/maestro
# rodando, dispara UM passo. Nunca mata nada. Sem projeto ligado, não faz nada.
LOG="$HOME/logs/regente.log"
mkdir -p "$HOME/logs"
for dir in "$HOME"/projetos/*/; do
  dir="${dir%/}"
  est="$dir/.framework/regente.json"
  [ -f "$est" ] || continue
  grep -Eq '"ligado"[[:space:]]*:[[:space:]]*true' "$est" || continue
  # colchete no primeiro caractere: o próprio pgrep não se acha
  pgrep -f "[a]rquiteto\\.mjs --pasta $dir" >/dev/null 2>&1 && continue
  pgrep -f "[m]aestro\\.mjs --pasta $dir" >/dev/null 2>&1 && continue
  nome=$(basename "$dir")
  echo "$(date '+%F %T') disparo $nome" >> "$LOG"
  setsid node "$HOME/projetos/VPS_cockpit/cc.mjs" regente passo --pasta "$dir" >> "$HOME/logs/regente-$nome.log" 2>&1 < /dev/null &
done
exit 0
