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

# Desde 11/09 a régua é linha NA TELA (mais de 12, a 80 caracteres cada): os
# parágrafos precisam ter tamanho de resposta de verdade, senão o caso não mede nada.
LONGA_SEM="Primeiro eu li o arquivo inteiro, do começo ao fim, para entender por onde o pedido passa antes de chegar na tela do painel.

Depois medi o tempo de cada chamada, uma a uma, com o relógio do próprio processo, e anotei qual delas passava de um segundo.

A terceira hipotese era a certa, e as outras duas caem por medicao: a leitura do disco e a rede ficaram abaixo de cinquenta milissegundos.

Entao troquei o regex que lia o registro inteiro por um que lê só a cauda, e rodei o gate completo, que passou sem nenhuma falha.

Conferi no navegador em tamanho de celular, abrindo a tela três vezes seguidas, e a lista apareceu inteira em todas, sem o atraso de antes.

Por fim reli o registro do dia para ver se outra tela usava a mesma leitura lenta, e achei mais uma, que ficou para o próximo item da fila, com a medida anotada no diário e o caminho do arquivo para quem pegar depois."

LONGA_COM="Primeiro eu li o arquivo inteiro.

Depois medi o tempo de cada chamada.

A terceira hipotese era a certa.

$SEP

O painel voltou a abrir em meio segundo. Confere no celular."

CURTA="Feito, o gate esta verde."

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "por que ficou lento?" a "$LONGA_SEM"
prova "quatro paragrafos sem o separador" resumo-guard 2 "$T/1.jsonl"

# 01/10: o disco atrasado não salva resposta SEM separador quando a final também não tem
FINAL_SEM=$(node -e 'process.stdout.write(JSON.stringify({ last_assistant_message: process.argv[1] }))' "$LONGA_SEM")
prova "disco e resposta final sem o separador" resumo-guard 2 "$T/1.jsonl" "$FINAL_SEM"

echo "— o que tem que passar —"
# 01/10, quinto falso positivo: o disco ainda sem o último pedaço, e a resposta final (que o Claude Code entrega no pedido) com o separador
FINAL_COM=$(node -e 'process.stdout.write(JSON.stringify({ last_assistant_message: process.argv[1] }))' "$LONGA_COM")
prova "disco atrasado, resposta final com o separador" resumo-guard 0 "$T/1.jsonl" "$FINAL_COM"
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
