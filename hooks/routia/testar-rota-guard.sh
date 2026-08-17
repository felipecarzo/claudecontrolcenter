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
| `front` | 🔴 ocupada | aaaa1111 — telas 📁 apps/ui.html#viewTrabalho | hoje |
| `vizinha` | 🔴 ocupada | cccc9999 — dados 📁 apps/dados.mjs · precisa de apps/tabela.js, que e da rota front: pedido feito | hoje |
| `dona-tabela` | 🔴 ocupada | dddd8888 — tabela 📁 apps/tabela.js | hoje |
| `back` | 🔴 ocupada | beef5678 — dados 📁 apps/ui.html#renderTabs apps/web.mjs | hoje |
| `repetido` | 🔴 ocupada | eeee2222 — tres arquivos 📁 apps/um.mjs 📁 apps/dois.mjs 📁 apps/tres.mjs | hoje |
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

# CC-114: `arquivo#parte` e a partilha declarada. Quem tambem declarou o
# arquivo edita; quem nao declarou continua barrado; arquivo sem `#` e posse
# inteira como sempre foi.
caso "partilha declarada: front edita o arquivo dividido" "libera" \
  "{\"session_id\":\"aaaa1111-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/ui.html\"}}"

caso "sem declarar: terceiro barrado no arquivo dividido" "bloqueia" \
  "{\"session_id\":\"cafe0000-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/ui.html\"}}"

caso "posse inteira: front barrado no arquivo so do back" "bloqueia" \
  "{\"session_id\":\"aaaa1111-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/web.mjs\"}}"

# 17/08: a PROSA depois dos arquivos declarados nao pode virar reivindicacao.
# Uma rota escreveu "📁 src/a.mjs · precisa de src/ui.html, que e da rota
# cockpit" e o parser colheu `src/ui.html` do meio da frase, dando ao vizinho a
# posse de um arquivo que ele estava pedindo emprestado. O guarda barrou o DONO.
caso "prosa da vizinha nao toma o arquivo do dono" "libera" \
  "{\"session_id\":\"dddd8888-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/tabela.js\"}}"

caso "e quem so citou em prosa continua barrado" "bloqueia" \
  "{\"session_id\":\"cccc9999-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/tabela.js\"}}"

# 18/08: repetir o 📁 em cada arquivo e a forma mais natural de escrever, e o
# laco parava no segundo marcador. Tudo depois do PRIMEIRO arquivo ficava sem
# protecao, com o quadro anunciando posse que a trava nao tinha. Tres rotas
# reais estavam assim quando o defeito apareceu.
# A sessao usada aqui e a `aaaa1111`, que TEM rota propria: sem isso o caso
# passaria por outro motivo (quem nao marcou rota ja e barrado em tudo), e o
# teste diria "ok" sobre o defeito. Foi o que aconteceu na primeira versao.
caso "📁 repetido: o PRIMEIRO arquivo protege" "bloqueia" \
  "{\"session_id\":\"aaaa1111-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/um.mjs\"}}"

caso "📁 repetido: o SEGUNDO tambem protege" "bloqueia" \
  "{\"session_id\":\"aaaa1111-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/dois.mjs\"}}"

caso "📁 repetido: e o TERCEIRO tambem" "bloqueia" \
  "{\"session_id\":\"aaaa1111-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/tres.mjs\"}}"

caso "📁 repetido: o dono continua editando os dele" "libera" \
  "{\"session_id\":\"eeee2222-ffff\",\"tool_input\":{\"file_path\":\"$REPO/apps/tres.mjs\"}}"

caso "entrada vazia (hook nao pode travar por bug proprio)" "libera" ""

caso "sem file_path" "libera" \
  "{\"session_id\":\"abcd1234-ffff\",\"tool_input\":{}}"

exit $FALHOU
