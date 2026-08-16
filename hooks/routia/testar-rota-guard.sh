#!/bin/bash
# Testa o rota-guard nos casos que importam. Cada caso imprime ESPERADO x OBTIDO.
#
# 2026-08-14: o projeto de teste passou a ser MONTADO aqui, numa pasta
# temporária. Antes era `REPO="D:/Documentos/Ti/projetos/CLIENTS/inovallbond"`
# fixo no código, e na VPS esse caminho não existe: o hook liberava certo (por
# não haver quadro) e o teste contava como falha. Resultado, medido: o Routia
# rodava na VPS sem nenhum teste válido cobrindo ele.
HOOK="$HOME/.claude/hooks/rota-guard.mjs"
BASE="${TMPDIR:-/tmp}/rota-guard-teste-$$"
REPO="$BASE/projeto-com-quadro"
SEM_QUADRO="$BASE/projeto-sem-quadro"
FALHOU=0

limpar() { rm -rf "$BASE"; }
trap limpar EXIT

mkdir -p "$REPO/docs" "$REPO/apps/game/src" "$REPO/tools/editor" "$SEM_QUADRO/apps"

cat > "$REPO/docs/ROTAS-ATIVAS.md" <<'QUADRO'
---
tipo: quadro
pastas-controladas: [apps, tools]
---

# Rotas ativas

| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
| `jogo` | 🔴 ocupada | outra9999 (outra sessão, não a do teste) | 2026-08-14 |
| `editor` | 🟢 livre | — | — |
QUADRO

caso() {
  local nome="$1" esperado="$2" json="$3"
  local saida
  saida=$(echo "$json" | node "$HOOK" 2>&1)
  local codigo=$?
  local obtido="libera"; [ $codigo -eq 2 ] && obtido="bloqueia"
  if [ "$obtido" = "$esperado" ]; then
    echo "  ok   $nome (esperado=$esperado)"
  else
    echo "  FALHA $nome, esperado=$esperado obtido=$obtido"
    echo "$saida" | head -3
    FALHOU=1
  fi
}

echo "== rota-guard =="

caso "codigo do jogo, sem rota marcada" "bloqueia" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/game/src/main.ts\"}}"

caso "ferramenta interna, sem rota marcada" "bloqueia" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{\"file_path\":\"$REPO/tools/editor/index.html\"}}"

caso "documentacao (nunca trava o end-session)" "libera" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{\"file_path\":\"$REPO/docs/HANDOFF.md\"}}"

caso "o proprio quadro (senao vira impossivel marcar)" "libera" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{\"file_path\":\"$REPO/docs/ROTAS-ATIVAS.md\"}}"

caso "projeto sem quadro" "libera" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{\"file_path\":\"$SEM_QUADRO/apps/arquivo.ts\"}}"

caso "entrada vazia (hook nao pode travar por bug proprio)" "libera" ""

caso "sem file_path" "libera" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{}}"

exit $FALHOU
