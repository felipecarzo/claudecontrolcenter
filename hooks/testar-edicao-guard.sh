#!/usr/bin/env bash
# Os casos do edicao-guard (16/08).
#
# O caso 'mensagem de commit que CITA sed -i' é o mais importante da lista: foi
# o primeiro falso positivo real, e ele apareceu no commit que descrevia o
# próprio hook. Texto dentro de heredoc é dado, não comando — um guarda que
# confunde os dois vira censor de prosa e acaba desligado.
set -u
H="$HOME/projetos/proj_controlcenter/hooks/edicao-guard.mjs"

caso() {
  echo "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":$(node -p 'JSON.stringify(process.argv[1])' "$2")}}" \
    | node "$H" > /dev/null 2>&1
  local s=$?
  [ "$s" = "$3" ] && echo "  ok     $1" || echo "  FALHOU $1 (saiu $s, esperava $3)"
}

echo "— o que precisa barrar —"
caso "sed -i em arquivo do repo"    "sed -i 's/a/b/' docs/ROADMAP.md"                    2
caso "python open(f,'w')"           "python3 -c \"open('src/ui.html','w').write(x)\""    2
caso "perl -i"                      "perl -i -pe 's/a/b/' src/web.mjs"                   2
caso "writeFileSync em node -e"     "node -e \"require('fs').writeFileSync('src/x.mjs',s)\"" 2

echo "— CC-299: os tres falsos positivos de 01/10, e o que continua barrando —"
caso "grep que procura o texto sed -i passa"          "grep -n \"sed -i\\|writeFileSync\" hooks/edicao-guard.mjs" 0
caso "writeFileSync no TMPDIR pelo Node passa"        "node -e \"require('fs').writeFileSync(process.env.TMPDIR+'/a.json','x')\"" 0
caso "writeFileSync em os.tmpdir() passa"             "node -e \"const os=require('os');require('fs').writeFileSync(os.tmpdir()+'/a','x')\"" 0
caso "comando que comeca em cd /tmp passa"            "cd /tmp/rascunho-muito-longo-de-proposito/sub/pasta && node -e \"$(printf 'x%.0s' {1..150}) ;require('fs').writeFileSync('topo.png',b)\"" 0
caso "grep junto de sed -i de verdade ainda barra"    "grep -n x src/web.mjs; sed -i 's/a/b/' src/web.mjs" 2
caso "writeFileSync em arquivo do repo ainda barra"   "node -e \"require('fs').writeFileSync('src/web.mjs',s)\"" 2

echo "— rascunho e livre —"
caso "sed -i em /tmp"               "sed -i 's/a/b/' /tmp/claude/x.md"                   0
caso "python -w em \$TMPDIR"        "python3 -c \"open('\$TMPDIR/x','w').write(1)\""     0

echo "— heredoc e TEXTO, nao comando —"
caso "commit que cita sed -i" "$(printf 'git commit -F - <<%s\nfix: o hook barra sed -i e open(f,\x27w\x27)\nMSG\n' "'MSG'")" 0
caso "cat > script com exemplo"   "$(printf 'cat > /home/x/t.sh <<%s\nsed -i s/a/b/ arquivo.md\nFIM\n' "'FIM'")" 0

echo "— comando comum nunca barra —"
caso "sed sem -i (so imprime)"      "sed 's/a/b/' docs/ROADMAP.md"                       0
caso "grep"                         "grep -n foo src/ui.html"                            0
caso "git status"                   "git status --short"                                 0
caso "npm test"                     "npm test"                                           0
caso "criar arquivo novo com >"     "echo oi > /home/x/novo.txt"                         0
