#!/usr/bin/env bash
# Os casos do guia-guard (CC-137, 18/08).
#
# Regra dele, 15/08: "se eu não acho o primeiro item da sua mensagem eu
# automaticamente perco todo o resto do texto". Uma âncora errada não custa a
# âncora, custa a mensagem inteira. Por isso guia longo vira etapa.
#
# O discriminador é o verbo no IMPERATIVO dirigido a ele. Contar o que eu fiz é
# histórico, não instrução, e não pode ser cobrado.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== guia-guard =="

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "como eu ligo isso?" a "Clique em configurações.
Abra a aba de agentes.
Selecione o projeto.
Marque a caixa de reportar."
prova "quatro passos de interface numa mensagem so" guia-guard 2 "$T/1.jsonl"

transcrito "$T/2.jsonl" u "como eu ligo isso?" a "1. Abra o painel.
2. Vá em módulos por projeto.
3. Toque no nome do projeto."
prova "lista numerada de tres passos" guia-guard 2 "$T/2.jsonl"

echo "— o que tem que passar —"
transcrito "$T/3.jsonl" u "como eu ligo isso?" a "Etapa 1 de 4: clique em configurações.
Abra a aba de agentes.
Selecione o projeto.
Me diga quando achar."
prova "ja declarou o total em etapas" guia-guard 0 "$T/3.jsonl"

transcrito "$T/4.jsonl" u "o que voce fez?" a "Abri o arquivo, copiei o bloco e colei no lugar certo.
Rodei o gate depois."
prova "relato do que EU fiz nao e instrucao para ele" guia-guard 0 "$T/4.jsonl"

transcrito "$T/5.jsonl" u "como eu ligo isso?" a "Clique em configurações e pronto."
prova "um passo so" guia-guard 0 "$T/5.jsonl"

transcrito "$T/6.jsonl" u "como eu subo o servidor?" a 'Rode isto:

```bash
cd projeto
npm install
npm run dev
```'
prova "comando dentro de bloco de codigo e UM passo, nao tres" guia-guard 0 "$T/6.jsonl"

echo "— higiene —"
higiene guia-guard

exit $FALHOU
