#!/usr/bin/env bash
# Os casos do fluxo-guard (CC-137, 18/08).
#
# A inversão que ela faz: com backlog aberto, PARAR é a exceção, e a exceção tem
# que ser declarada. Antes, continuar era o padrão e parar só era pego quando eu
# quebrava uma promessa explícita.
#
# São cinco saídas legítimas, e o teste cobre as cinco: ele perguntou algo, a
# pergunta foi feita na ferramenta própria, a parada foi declarada, o backlog
# está zerado, ou o turno é uma ROTINA que termina esperando por ele (18/08).
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== fluxo-guard =="

# Um projeto com framework ligado, num modo de execução em sequência, e um
# backlog com item aberto. Sem esses três a trava nem opina.
PROJ="$T/projeto"
mkdir -p "$PROJ/docs" "$PROJ/.framework"
printf '%s\n' "# ROADMAP" "" "### CC-01 — a entrevista na tela" "" "### CC-02 — o botao de projeto novo" \
  > "$PROJ/docs/ROADMAP.md"
node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], JSON.stringify({
  metodo: "mvp-basico", modo: "restritivo", fase: "execucao", ligado: true,
  mvp: { nome: "o painel", criterios: [{ texto: "abre", feito: true }] },
  ferramentas: [], verificacao: {}, autorizado: [], historico: [],
}, null, 1))
' "$PROJ/.framework/estado.json"

SEM_FRAMEWORK="$T/sem"
mkdir -p "$SEM_FRAMEWORK/docs"
cp "$PROJ/docs/ROADMAP.md" "$SEM_FRAMEWORK/docs/ROADMAP.md"

no_projeto() { echo "{\"cwd\":\"$1\"}"; }

echo "— o que precisa empurrar de volta —"
transcrito "$T/1.jsonl" u "termina isso ai" t Edit '{"file_path":"/x/src/web.mjs"}' \
  a "Feito. Quer que eu siga para o proximo?"
prova "parou com backlog aberto, sem declarar por que" fluxo-guard 2 "$T/1.jsonl" "$(no_projeto "$PROJ")"

echo "— as quatro saidas legitimas —"
transcrito "$T/2.jsonl" u "por que o painel ficou lento?" a "Porque o transcrito passou de 25 MB."
prova "ele perguntou: responder E a entrega" fluxo-guard 0 "$T/2.jsonl" "$(no_projeto "$PROJ")"

transcrito "$T/3.jsonl" u "termina isso ai" \
  t AskUserQuestion '{"questions":[{"question":"qual das duas frentes primeiro?"}]}' \
  a "Escolha ai."
prova "perguntou na ferramenta propria: a bola esta com ele" fluxo-guard 0 "$T/3.jsonl" "$(no_projeto "$PROJ")"

transcrito "$T/4.jsonl" u "termina isso ai" t Edit '{"file_path":"/x/src/web.mjs"}' \
  a "Parada: o proximo item pede escolha de gosto entre duas paletas."
prova "parada declarada, com motivo que so ele decide" fluxo-guard 0 "$T/4.jsonl" "$(no_projeto "$PROJ")"

transcrito "$T/5.jsonl" u "termina isso ai" t Edit '{"file_path":"/x/src/web.mjs"}' a "Feito."
prova "projeto sem framework ligado: a trava nem opina" fluxo-guard 0 "$T/5.jsonl" "$(no_projeto "$SEM_FRAMEWORK")"

# A quinta saída (18/08): a rotina /start-session termina dizendo, com todas
# as letras, para aguardar instrução dele — e isso tem que segurar a trava
# mesmo com backlog aberto, porque parar ali é o combinado, não um furo.
mkdir -p "$PROJ/.claude/commands"
printf '%s\n' "Passo 1. Passo 2." "" "Após este comando, aguarde instrução do usuário para começar a trabalhar." \
  > "$PROJ/.claude/commands/start-session.md"
transcrito "$T/6.jsonl" \
  u "<command-message>start-session is running…</command-message>\n<command-name>/start-session</command-name>" \
  t Bash '{"command":"git status --short"}' \
  a "INICIO DE SESSAO\n\nPronto para comecar."
prova "rotina que termina esperando por ele: a trava nao cobra" fluxo-guard 0 "$T/6.jsonl" "$(no_projeto "$PROJ")"
rm -f "$PROJ/.claude/commands/start-session.md"

# Achado em 18/08: titulo de frente vem hoje como "### CC-101 Frente: ...",
# com o numero ANTES da palavra "Frente". A exclusao so casava "### Frente:"
# sem numero, entao toda frente numerada (CC-101, CC-102, CC-104...) voltava
# pra fila mesmo sem proximo passo executavel.
SO_FRENTE="$T/so-frente"
mkdir -p "$SO_FRENTE/docs" "$SO_FRENTE/.framework"
printf '%s\n' "# ROADMAP" "" "### CC-101 Frente: a tela fala a sua lingua, aprovada em 15/08" \
  "" "sem proximo passo executavel, so estudo." \
  > "$SO_FRENTE/docs/ROADMAP.md"
node -e '
const fs = require("fs")
fs.writeFileSync(process.argv[1], JSON.stringify({
  metodo: "mvp-basico", modo: "restritivo", fase: "execucao", ligado: true,
  mvp: { nome: "o painel", criterios: [{ texto: "abre", feito: true }] },
  ferramentas: [], verificacao: {}, autorizado: [], historico: [],
}, null, 1))
' "$SO_FRENTE/.framework/estado.json"
transcrito "$T/7.jsonl" u "termina isso ai" t Edit '{"file_path":"/x/src/web.mjs"}' a "Feito."
prova "titulo de frente com numero antes nao conta como item aberto" fluxo-guard 0 "$T/7.jsonl" "$(no_projeto "$SO_FRENTE")"

echo "— higiene —"
higiene fluxo-guard

exit $FALHOU
