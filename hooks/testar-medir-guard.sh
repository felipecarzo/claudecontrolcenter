#!/usr/bin/env bash
# Os casos do medir-guard (CC-137, 18/08).
#
# A regra que ela guarda é a sétima do ciclo dele: as hipóteses de causa que ele
# levanta são plausíveis e às vezes erradas, e agir nelas já piorou o produto
# duas vezes no mesmo dia. Sintoma descrito pede MEDIÇÃO antes de conserto.
#
# A linha entre sintoma e ordem é o coração da trava: "faz uma aba nova" é
# ordem e não pede medição; "ta estranho" é sintoma e pede.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== medir-guard =="
EDITOU='{"file_path":"/x/src/ui.html"}'

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "o menu ta estranho no celular" t Edit "$EDITOU" a "Ajustei o menu."
prova "sintoma descrito, consertei sem medir" medir-guard 2 "$T/1.jsonl"

transcrito "$T/2.jsonl" u "o menu fica sumindo quando eu clico" t Edit "$EDITOU" a "Consertado."
prova "o gerundio conta: e assim que se descreve o que acontece toda hora" medir-guard 2 "$T/2.jsonl"

transcrito "$T/3.jsonl" u "nao consigo ler o texto do cartao" t Edit "$EDITOU" a "Aumentei a fonte."
prova "queixa de leitura, mexi direto" medir-guard 2 "$T/3.jsonl"

echo "— o que tem que passar —"
transcrito "$T/4.jsonl" u "cria uma aba nova para os documentos" t Edit "$EDITOU" a "Aba criada."
prova "ordem nao e sintoma, e ordem nao pede medicao" medir-guard 0 "$T/4.jsonl"

transcrito "$T/5.jsonl" u "o menu ta estranho no celular" \
  t Bash '{"command":"node medir-largura.mjs 390"}' \
  t Edit "$EDITOU" a "Medi antes: o menu somava 480px num painel de 390."
prova "script de medicao com nome proprio conta como medicao" medir-guard 0 "$T/5.jsonl"

transcrito "$T/8.jsonl" u "o menu ta estranho no celular" \
  t Grep '{"pattern":"tabs"}' \
  t Edit "$EDITOU" a "Achei a regra duplicada no CSS."
prova "procurar no codigo tambem e medir" medir-guard 0 "$T/8.jsonl"

transcrito "$T/6.jsonl" u "o menu ta estranho no celular" a "O que exatamente esta estranho nele?"
prova "sintoma, e eu perguntei em vez de chutar" medir-guard 0 "$T/6.jsonl"

echo "— higiene —"
higiene medir-guard

exit $FALHOU
