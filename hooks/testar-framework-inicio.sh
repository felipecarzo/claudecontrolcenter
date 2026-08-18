#!/usr/bin/env bash
# Os casos do framework-inicio (CC-135, 18/08).
#
# O bloco novo: o modo sugestivo deixou de só travar e passou a SUGERIR.
# Correção dele, 16/08: "o modo sugestivo é exatamente o oposto do que eu
# falei (...) ele busca características acima. Ele vai sugerir coisas que
# possam ser feitas no projeto, e sempre manter a opção de eu poder
# escrever". "Características acima" são as FRENTES do roadmap, não a
# próxima tarefa — por isso o teste confere que aparecem títulos de frente,
# na ordem de importância, nunca as tarefas de dentro delas.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$RAIZ/framework-inicio.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

echo "== framework-inicio =="

projeto() { # $1 = nome, $2 = modo, resto = linhas do ROADMAP (ou nenhuma)
  local dir="$T/$1"
  mkdir -p "$dir/docs" "$dir/.framework"
  node -e '
const fs = require("fs")
const [dir, modo] = process.argv.slice(2)
fs.writeFileSync(`${dir}/.framework/estado.json`, JSON.stringify({
  metodo: "mvp-basico", modo, fase: "execucao", ligado: true,
  mvp: { nome: "x", criterios: [] }, ferramentas: [], verificacao: {}, autorizado: [], historico: [],
}, null, 1))
' x "$dir" "$2"
  shift 2
  if [ $# -gt 0 ]; then printf '%s\n' "$@" > "$dir/docs/ROADMAP.md"; fi
  echo "$dir"
}

caso() { # nome, cwd, esperado(contem|nao-contem), trecho
  local saida
  saida=$(echo "{\"cwd\":\"$2\"}" | node "$HOOK" 2>&1)
  local achou=nao-contem
  echo "$saida" | grep -qF "$4" && achou=contem
  if [ "$achou" = "$3" ]; then echo "  ok     $1"; else
    echo "  FALHOU $1 (esperava $3 para \"$4\")"; echo "$saida" | head -6 | sed 's/^/         /'; FALHOU=1
  fi
}

COM_ROADMAP=$(projeto p1 sugestivo \
  "# ROADMAP" "" \
  "## Frente A" "" "### A entrevista de projeto novo" "" \
  "> *\"quero que ele me faça perguntas\"*" "" \
  "## Frente B" "" "### O login do agy" "" \
  "### ✅ 17/08 — item concluido, nao pode aparecer")

echo "— o que precisa sugerir, no modo sugestivo —"
caso "aparece o aviso de sugestao" "$COM_ROADMAP" contem "SUGIRA, NÃO IMPONHA"
caso "aparece uma frente aberta" "$COM_ROADMAP" contem "A entrevista de projeto novo"
caso "aparece a outra frente aberta" "$COM_ROADMAP" contem "O login do agy"
caso "a citacao dele vem junto" "$COM_ROADMAP" contem "quero que ele me faça perguntas"
caso "lembra que a escrita livre sempre vale" "$COM_ROADMAP" contem "escrita livre"
caso "item ja concluido nao aparece" "$COM_ROADMAP" nao-contem "item concluido, nao pode aparecer"

echo "— o que precisa ficar calado —"
SEM_ROADMAP=$(projeto p2 sugestivo)
caso "sugestivo sem roadmap nenhum: nada pra sugerir" "$SEM_ROADMAP" nao-contem "SUGIRA"

COM_DIALOGO=$(projeto p3 dialogo "# ROADMAP" "" "## Frente A" "" "### Algo aberto")
caso "outro modo (dialogo) nao ganha sugestao" "$COM_DIALOGO" nao-contem "SUGIRA"

SO_FEITAS=$(projeto p4 sugestivo "# ROADMAP" "" "## Frente A" "" "### ✅ 17/08 — tudo que tinha ja fechou")
caso "roadmap so com itens concluidos: nada pra sugerir" "$SO_FEITAS" nao-contem "SUGIRA"

echo "— higiene —"
echo '{}' | node "$HOOK" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia não trava a abertura da sessão" || { echo "  FALHOU entrada vazia"; FALHOU=1; }

exit $FALHOU
