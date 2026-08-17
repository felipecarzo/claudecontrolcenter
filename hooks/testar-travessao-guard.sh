#!/usr/bin/env bash
# Os casos do travessao-guard.
#
# É a regra número 1 dele, escrita há meses no arquivo global e sem ninguém
# cobrando: 279 travessões medidos num dia só. A trava cobre a resposta no chat
# e o texto que vai para arquivo PÚBLICO.
#
# A fronteira entre público e interno é decisão dele, de 16/08: "Travessao em
# backend e anotacao nao tem problema, o problema é em texto publico".
set -u
H="$HOME/projetos/proj_controlcenter/hooks/travessao-guard.mjs"
T=$(mktemp -d)
FALHOU=0
TRACO=$(printf '—')   # o travessão, escrito assim para o arquivo não ter um

arquivo() { # nome, caminho, texto, exit esperado
  node -e '
process.stdout.write(JSON.stringify({
  tool_name: "Edit",
  tool_input: { file_path: process.argv[2], new_string: process.argv[3] },
}))' x "$2" "$3" | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$4" ] && echo "  ok     $1" || { echo "  FALHOU $1 (saiu $s, esperava $4)"; FALHOU=1; }
}

echo "— arquivo PÚBLICO: tem que barrar —"
arquivo "pagina html"        "/x/src/ui.html"        "o painel $TRACO agora com abas" 2
arquivo "componente jsx"     "/x/src/Card.jsx"       "<p>tudo pronto $TRACO confira</p>" 2
arquivo "pasta apps"         "/x/apps/site/copy.js"  "const t = 'venha $TRACO e traga alguem'" 2
arquivo "README"             "/x/README.md"          "instala assim $TRACO e roda" 2

echo "— arquivo INTERNO: livre, decisão dele em 16/08 —"
arquivo "comentario em modulo" "/x/src/jobs.mjs"     "// o cache guarda blocos $TRACO e nao totais" 0
arquivo "documentacao interna" "/x/docs/ROADMAP.md"  "a frente nasceu assim $TRACO e ficou" 0
arquivo "teste"                "/x/test.mjs"         "// mede $TRACO nao julga" 0

echo "— texto limpo passa em qualquer lugar —"
arquivo "html sem traco longo" "/x/src/ui.html"      "o painel, agora com abas. E hifen-composto continua valendo" 0

echo "— nao pode travar por bug proprio —"
echo '{}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     entrada vazia" || { echo "  FALHOU entrada vazia"; FALHOU=1; }
echo '{"tool_name":"Read","tool_input":{"file_path":"/x/src/ui.html"}}' | node "$H" > /dev/null 2>&1
[ $? = 0 ] && echo "  ok     leitura passa" || { echo "  FALHOU leitura"; FALHOU=1; }

rm -rf "$T"
exit $FALHOU
