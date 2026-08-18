#!/usr/bin/env bash
# Os casos do visual-guard (CC-137, 18/08).
#
# A trava nasceu de um caso real: entreguei uma tela conferida só em 390px, ele
# abriu no monitor e respondeu "olha esse design, ta horripilante". O sinal de
# que eu olhei é mecânico e é um só: abrir uma imagem com o Read, porque é a
# única ferramenta que me mostra pixel. Teste verde não conta, e o projeto já
# teve 545 passando com a tela quebrada.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== visual-guard =="
PEDIDO='ajeita o espacamento dos cartoes'

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "$PEDIDO" t Edit '{"file_path":"/x/src/ui.html"}' a "Ajustado."
prova "mexeu na tela e nao olhou imagem nenhuma" visual-guard 2 "$T/1.jsonl"

transcrito "$T/2.jsonl" u "$PEDIDO" \
  t Write '{"file_path":"/x/src/estilo.css"}' \
  t Bash '{"command":"npm test"}' a "Gate verde, esta pronto."
prova "rodou o gate mas nao olhou: teste verde nao e prova visual" visual-guard 2 "$T/2.jsonl"

echo "— o que tem que passar —"
transcrito "$T/3.jsonl" u "$PEDIDO" \
  t Edit '{"file_path":"/x/src/ui.html"}' \
  t Read '{"file_path":"/tmp/shots/tela.png"}' a "Conferido no print."
prova "mexeu e abriu o print" visual-guard 0 "$T/3.jsonl"

transcrito "$T/4.jsonl" u "$PEDIDO" \
  t Edit '{"file_path":"/x/src/ui.html"}' \
  t Agent '{"prompt":"tire o print da tela em 390px e me diga o que voce ve"}' a "O subagente olhou."
prova "delegou o olhar a um subagente, e ele olhou" visual-guard 0 "$T/4.jsonl"

transcrito "$T/5.jsonl" u "$PEDIDO" t Edit '{"file_path":"/x/src/web.mjs"}' a "So o servidor."
prova "mexeu em codigo que nao e tela" visual-guard 0 "$T/5.jsonl"

transcrito "$T/6.jsonl" u "$PEDIDO" t Read '{"file_path":"/x/src/ui.html"}' a "E assim que esta hoje."
prova "so leu a tela, nao mexeu" visual-guard 0 "$T/6.jsonl"

echo "— higiene —"
higiene visual-guard

exit $FALHOU
