#!/usr/bin/env bash
# Os casos do resumo-guard (CC-137, 18/08).
#
# Ele pediu o separador em 16/08 e eu não usei na resposta seguinte. Palavras
# dele: "eu te peço uma coisa, voce ignora e depois fala que foi erro humano pq
# eu nao pedi o suficiente".
#
# A medida honesta é a que só cobra resposta LONGA: cobrar resposta curta faria
# o número dizer que eu piorei num dia em que só respondi perguntas rápidas.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== resumo-guard =="
SEP='---------------------------------- // resumo // ----------------------------------'

LONGA_SEM="Primeiro eu li o arquivo inteiro.

Depois medi o tempo de cada chamada.

A terceira hipotese era a certa, e as outras duas caem por medicao.

Entao troquei o regex e rodei o gate."

LONGA_COM="Primeiro eu li o arquivo inteiro.

Depois medi o tempo de cada chamada.

A terceira hipotese era a certa.

$SEP

O painel voltou a abrir em meio segundo. Confere no celular."

CURTA="Feito, o gate esta verde."

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "por que ficou lento?" a "$LONGA_SEM"
prova "quatro paragrafos sem o separador" resumo-guard 2 "$T/1.jsonl"

echo "— o que tem que passar —"
transcrito "$T/2.jsonl" u "por que ficou lento?" a "$LONGA_COM"
prova "resposta longa COM o separador" resumo-guard 0 "$T/2.jsonl"

transcrito "$T/3.jsonl" u "rodou?" a "$CURTA"
prova "resposta curta nao precisa de separador" resumo-guard 0 "$T/3.jsonl"

transcrito "$T/4.jsonl" u "me mostra o comando" a 'Este aqui:

```bash
npm test
npm run dev
node cc.mjs json
```

Pronto.'
prova "bloco de codigo nao vira paragrafo de prosa" resumo-guard 0 "$T/4.jsonl"

echo "— higiene —"
higiene resumo-guard

exit $FALHOU
