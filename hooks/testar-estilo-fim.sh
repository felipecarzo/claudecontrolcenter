#!/usr/bin/env bash
# Os casos do estilo-fim (CC-137, 18/08).
#
# Ela não reclama de nada: mede a resposta que acabou de sair e guarda o número.
# O pedido dele era esse mesmo, e o motivo está escrito no próprio arquivo: se
# não dá para impedir o vício de estilo, que ao menos apareça quando eu voltar
# a ele.
#
# Como se prova uma trava que não trava: conferindo o que ela GRAVOU. A casa é
# de teste, porque escrever na medição de verdade dele falsearia a série
# histórica que a aba de estilo mostra.
set -u
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$RAIZ/hooks/estilo-fim.mjs"
T=$(mktemp -d)
FALHOU=0
trap 'rm -rf "$T"' EXIT

export CC_HOME="$T/casa"
mkdir -p "$CC_HOME"
MEDIDAS="$CC_HOME/control-center-estilo.json"

echo "== estilo-fim =="

resposta() { # monta um transcrito com uma resposta minha
  node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], [
  JSON.stringify({ type: "user", message: { content: "e ai?" } }),
  JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: process.argv[2] }] } }),
].join("\n"))
' "$1" "$2"
}

confere() { if [ "$2" = 0 ]; then echo "  ok     $1"; else echo "  FALHOU $1"; FALHOU=1; fi; }

LONGA="Primeiro eu li o arquivo.

Nao fiz essa parte de proposito, por dois motivos.

Depois medi o tempo de cada chamada.

E entao troquei o regex."

resposta "$T/1.jsonl" "$LONGA"
echo "{\"transcript_path\":\"$T/1.jsonl\"}" | node "$HOOK" > /dev/null 2>&1
confere "sai com 0: ela mede, nao barra" $?

echo "— o que ela precisa ter gravado —"
[ -f "$MEDIDAS" ]; confere "gravou o arquivo de medidas na casa de teste" $?

node -e '
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
const u = d.respostas[d.respostas.length - 1]
const erros = []
if (d.respostas.length !== 1) erros.push("deveria haver uma medida, ha " + d.respostas.length)
if (u.paragrafos !== 4) erros.push("paragrafos: esperava 4, veio " + u.paragrafos)
if (!u.autodefesa) erros.push("nao contou a abertura de autodefesa (\"Nao fiz essa parte de proposito\")")
if (!u.semMarcador) erros.push("resposta longa sem separador tinha que ser marcada")
if (u.trechos) erros.push("o TEXTO dele nao pode ir para o arquivo de medidas, so o numero")
if (erros.length) { console.log("   " + erros.join("\n   ")); process.exit(1) }
' "$MEDIDAS"
confere "mediu paragrafos, autodefesa e a falta do separador" $?

resposta "$T/2.jsonl" "Feito."
echo "{\"transcript_path\":\"$T/2.jsonl\"}" | node "$HOOK" > /dev/null 2>&1
node -e '
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
process.exit(d.respostas.length === 2 ? 0 : 1)
' "$MEDIDAS"
confere "cada turno acrescenta uma medida, nao sobrescreve" $?

echo "— nao pode quebrar o fim do turno —"
echo '{}' | node "$HOOK" > /dev/null 2>&1; confere "entrada vazia" $?
echo '{"stop_hook_active":true}' | node "$HOOK" > /dev/null 2>&1; confere "dentro de outro Stop nao mede de novo" $?
echo "{\"transcript_path\":\"$T/nao-existe.jsonl\"}" | node "$HOOK" > /dev/null 2>&1
confere "transcrito que nao existe" $?

exit $FALHOU
