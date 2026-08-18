#!/usr/bin/env bash
# Os casos do fluxo-guard (CC-137, 18/08).
#
# A inversão que ela faz: com backlog aberto, PARAR é a exceção, e a exceção tem
# que ser declarada. Antes, continuar era o padrão e parar só era pego quando eu
# quebrava uma promessa explícita.
#
# São quatro saídas legítimas, e o teste cobre as quatro: ele perguntou algo, a
# pergunta foi feita na ferramenta própria, a parada foi declarada, ou o backlog
# está zerado.
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

echo "— higiene —"
higiene fluxo-guard

exit $FALHOU
