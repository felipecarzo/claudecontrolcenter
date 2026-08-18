#!/usr/bin/env bash
# Os casos do descida-guard (CC-137, 18/08).
#
# Quando ele reprova, refazer no mesmo nível é repetir o erro com outra roupa. O
# que a trava exige é descer um degrau: registrar as tarefas do que vai ser
# feito, em vez de sair mexendo de novo.
#
# A lista de reprovação é de PALAVRA DELE ("horripilante", "refaz", "não era
# isso"), não de sentimento genérico: ampliar pegaria conversa comum.
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== descida-guard =="
EDITOU='{"file_path":"/x/src/ui.html"}'
REGISTROU='{"command":"node cc.mjs set {\"todos\":[{\"text\":\"quebrar a tela em tres partes\"}]}"}'

echo "— o que precisa barrar —"
transcrito "$T/1.jsonl" u "ficou horripilante, refaz" t Edit "$EDITOU" a "Refiz o espacamento."
prova "reprovou e eu refiz no mesmo nivel" descida-guard 2 "$T/1.jsonl"

transcrito "$T/2.jsonl" u "nao era isso que eu pedi" t Write "$EDITOU" a "Mudei a cor."
prova "reprovou com outra palavra dele" descida-guard 2 "$T/2.jsonl"

echo "— o que tem que passar —"
transcrito "$T/3.jsonl" u "ficou horripilante, refaz" \
  t Bash "$REGISTROU" t Edit "$EDITOU" a "Quebrei em tarefas antes de mexer."
prova "desceu um degrau: registrou as tarefas antes" descida-guard 0 "$T/3.jsonl"

transcrito "$T/4.jsonl" u "ficou horripilante, refaz" a "O que exatamente ficou ruim, o espacamento ou a cor?"
prova "reprovou e eu perguntei em vez de mexer" descida-guard 0 "$T/4.jsonl"

transcrito "$T/5.jsonl" u "ficou otimo, pode seguir" t Edit "$EDITOU" a "Segui."
prova "elogio nao e reprovacao" descida-guard 0 "$T/5.jsonl"

echo "— higiene —"
higiene descida-guard

exit $FALHOU
