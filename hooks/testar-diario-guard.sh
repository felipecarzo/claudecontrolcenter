#!/usr/bin/env bash
# Os casos do diario-guard (18/08, pedido do Felipe: "seria bom termos isso
# como boa prática, usando hook").
#
# Esta trava AVISA e libera: sai sempre com 0, e o que se mede é o texto —
# mesmo padrão do roadmap-guard, e pelo mesmo motivo (travar no fim do turno
# criaria laço, porque é exatamente quando o diário se escreve).
source "$(dirname "${BASH_SOURCE[0]}")/testar-comum.sh"

echo "== diario-guard =="

HOJE=$(date -u +%Y-%m-%d)

projeto() { # monta um projeto com docs/diario, pra contar como projeto que usa a convenção
  local dir="$T/$1"
  mkdir -p "$dir/docs/diario"
  echo "$dir"
}

PROJ=$(projeto p1)
SEM_DIARIO="$T/p2"
mkdir -p "$SEM_DIARIO/docs"

echo "— o que precisa avisar —"
transcrito "$T/1.jsonl" u "conserta isso" t Edit '{"file_path":"'"$PROJ"'/src/x.mjs"}' a "Feito."
diz "codigo mexido sem tocar no diario de hoje" diario-guard sim "CÓDIGO MEXIDO SEM PASSAR PELO DIÁRIO" \
  "{\"cwd\":\"$PROJ\",\"transcript_path\":\"$T/1.jsonl\"}"
diz "cita o arquivo mexido" diario-guard sim "src/x.mjs" \
  "{\"cwd\":\"$PROJ\",\"transcript_path\":\"$T/1.jsonl\"}"

echo "— o que tem que ficar calado —"
transcrito "$T/2.jsonl" u "conserta isso" \
  t Edit '{"file_path":"'"$PROJ"'/src/x.mjs"}' \
  t Write "{\"file_path\":\"$PROJ/docs/diario/$HOJE.md\"}" \
  a "Feito, e registrado."
diz "diario de hoje foi tocado no mesmo turno" diario-guard nao "CÓDIGO MEXIDO" \
  "{\"cwd\":\"$PROJ\",\"transcript_path\":\"$T/2.jsonl\"}"

transcrito "$T/3.jsonl" u "atualiza o mapa" t Edit '{"file_path":"'"$PROJ"'/docs/ROADMAP.md"}' a "Feito."
diz "turno so mexeu em docs/: nada de codigo pra registrar" diario-guard nao "CÓDIGO MEXIDO" \
  "{\"cwd\":\"$PROJ\",\"transcript_path\":\"$T/3.jsonl\"}"

transcrito "$T/4.jsonl" u "por que o painel ficou lento?" a "Porque o transcrito passou de 25 MB."
diz "turno sem edicao nenhuma" diario-guard nao "CÓDIGO MEXIDO" \
  "{\"cwd\":\"$PROJ\",\"transcript_path\":\"$T/4.jsonl\"}"

diz "projeto sem docs/diario: convencao nem existe aqui" diario-guard nao "CÓDIGO MEXIDO" \
  "{\"cwd\":\"$SEM_DIARIO\",\"transcript_path\":\"$T/1.jsonl\"}"

echo "— higiene —"
higiene diario-guard

exit $FALHOU
