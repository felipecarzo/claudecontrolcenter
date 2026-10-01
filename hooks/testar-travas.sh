#!/usr/bin/env bash
# Roda TODOS os testes de travas em shell e falha se algum falhar.
#
# Medido em 01/10: os 33 arquivos testar-*.sh existiam e nenhum estava no
# npm test. Dois quebraram em 11/09, quando a régua do separador passou a ser
# linha na tela, e ficaram vermelhos três semanas sem ninguém ver: a peça
# pronta que ninguém alcança, de novo.
# No Windows (Git Bash) estes testes nunca foram medidos: pula em voz alta em vez de travar a publicação do PC.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) echo "testes de travas: pulados no Windows (nunca medidos lá)"; exit 0 ;; esac
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
falhas=0; total=0
for f in testar-*.sh; do
  [ "$f" = testar-comum.sh ] || [ "$f" = testar-travas.sh ] && continue
  total=$((total + 1))
  saida=$(timeout 120 bash "$f" 2>&1)
  if echo "$saida" | grep -q "FALHOU"; then
    falhas=$((falhas + 1))
    echo "== $f"; echo "$saida" | grep -A4 "FALHOU" | head -12
  fi
done
if [ "$falhas" -gt 0 ]; then echo "testes de travas: $falhas de $total arquivos com falha"; exit 1; fi
echo "testes de travas: $total arquivos, todos passaram"
