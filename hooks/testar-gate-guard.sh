#!/usr/bin/env bash
# Os casos do gate-guard (CC-137, 18/08).
#
# A trava: editei código e encerrei o turno sem rodar o gate. O que ela guarda
# é a regra mais barata deste projeto, e a que mais some no meio de um turno
# longo. Documentação e assets ficam de fora de propósito: `npm test` não fala
# sobre texto.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== gate-guard =="
PEDIDO='conserta o calculo do progresso'

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "$PEDIDO" t Edit '{"file_path":"/x/src/web.mjs"}' a "Pronto."
prova "editou codigo e nao rodou o gate" gate-guard 2 "$T/1.jsonl"

transcrito "$T/2.jsonl" u "$PEDIDO" \
  t Bash '{"command":"npm test"}' \
  t Edit '{"file_path":"/x/src/web.mjs"}' a "Pronto."
prova "rodou o gate ANTES da ultima edicao, que e o mesmo que nao rodar" gate-guard 2 "$T/2.jsonl"

transcrito "$T/3.jsonl" u "$PEDIDO" \
  t Bash '{"command":"sed -i s/a/b/ /x/src/web.mjs"}' a "Trocado."
prova "editou por script no Bash, que tambem e edicao" gate-guard 2 "$T/3.jsonl"

echo "— o que tem que passar —"
transcrito "$T/4.jsonl" u "$PEDIDO" \
  t Edit '{"file_path":"/x/src/web.mjs"}' \
  t Bash '{"command":"npm test"}' a "Gate verde."
prova "editou e rodou o gate depois" gate-guard 0 "$T/4.jsonl"

transcrito "$T/5.jsonl" u "$PEDIDO" t Edit '{"file_path":"/x/docs/ROADMAP.md"}' a "Anotado."
prova "mexeu so em documentacao" gate-guard 0 "$T/5.jsonl"

transcrito "$T/6.jsonl" u "$PEDIDO" t Read '{"file_path":"/x/src/web.mjs"}' a "E aqui."
prova "so leu, nao editou" gate-guard 0 "$T/6.jsonl"

transcrito "$T/7.jsonl" u "$PEDIDO" \
  t Write '{"file_path":"/tmp/rascunho.mjs"}' \
  t Bash '{"command":"sed -i s/a/b/ /tmp/rascunho.mjs"}' a "So um rascunho."
prova "script mexendo em /tmp nao conta como edicao do projeto" gate-guard 0 "$T/7.jsonl"

echo "— higiene —"
higiene gate-guard

exit $FALHOU
