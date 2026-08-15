#!/bin/bash
# Testa o ciclo de autorizacao entre agentes de ponta a ponta, chamando os hooks
# do mesmo jeito que o Claude Code chama: JSON no stdin, codigo de saida importa.
#
#   exit 0 = liberou    exit 2 = bloqueou
#
# Usa caminho nativo do Windows, nao /tmp: o Git Bash traduz /tmp para C:\tmp e
# o Node resolve diferente, o que fazia o teste anterior medir a coisa errada.
# A conversao continua sendo feita por `pwd -W` mais abaixo, que e o que de fato
# resolve isso; a pasta escolhida aqui e so onde o projeto de teste e montado.
#
# 2026-08-14: a pasta deixou de ser fixa. Era `~/.claude/jobs/48f6738c/tmp`, de
# um job especifico, e na VPS ela e read-only dentro do sandbox: o teste falhava
# 12 vezes sem que o hook tivesse problema nenhum. Agora tenta essa pasta e cai
# para uma temporaria quando nao da para escrever, dizendo qual escolheu.
set -u
H="$HOME/.claude/hooks"
BASE="$HOME/.claude/jobs/48f6738c/tmp"
if ! mkdir -p "$BASE" 2>/dev/null || ! touch "$BASE/.escrita" 2>/dev/null; then
  BASE=$(mktemp -d 2>/dev/null) || BASE="${TMPDIR:-/tmp}/rota-pedidos-teste-$$"
  mkdir -p "$BASE"
  echo "  (pasta do job nao e gravavel aqui, usando $BASE)"
fi
rm -f "$BASE/.escrita"
RAIZ="$BASE/proj-teste"
LIMPO="$BASE/proj-limpo"
rm -rf "$RAIZ" "$LIMPO"
mkdir -p "$RAIZ/docs" "$RAIZ/src" "$LIMPO/src"

cat > "$RAIZ/docs/ROTAS-ATIVAS.md" <<'MD'
---
pastas-controladas: [src]
---
| Rota | Status | Quem / o quê | Desde |
|---|---|---|---|
| `motor` | 🔴 ocupada | aaaa1111 — mexendo no motor | hoje |
| `livre` | 🟢 livre | — | — |
MD
echo "conteudo" > "$RAIZ/src/motor.mjs"
echo "outro" > "$RAIZ/src/outro.mjs"
echo "x" > "$LIMPO/src/a.mjs"

# caminho no formato que o Node do Windows entende
WRAIZ=$(cd "$RAIZ" && pwd -W 2>/dev/null || echo "$RAIZ")
WLIMPO=$(cd "$LIMPO" && pwd -W 2>/dev/null || echo "$LIMPO")

DONO=aaaa1111-0000-0000-0000-000000000000
OUTRO=bbbb2222-0000-0000-0000-000000000000
TERCEIRO=cccc3333-0000-0000-0000-000000000000

guard() { # $1 = session_id, $2 = caminho do arquivo
  echo "{\"session_id\":\"$1\",\"tool_input\":{\"file_path\":\"$2\"}}" \
    | node "$H/rota-guard.mjs" >/dev/null 2>"$BASE/err.txt"
  echo $?
}
fim() { # $1 = session_id
  echo "{\"session_id\":\"$1\",\"cwd\":\"$WRAIZ\"}" | node "$H/routia-fim.mjs" 2>/dev/null
}
pedidoId() { # $1 = trecho do nome do arquivo
  node -e "
const fs=require('fs')
const f='$WRAIZ/docs/.rotas-pedidos.json'
if(!fs.existsSync(f)){console.log('');process.exit(0)}
const p=JSON.parse(fs.readFileSync(f,'utf8')).pedidos
const x=p.find(y=>y.arquivo.includes('$1'))
console.log(x?x.id:'')"
}

falhas=0
checar() { # $1 = descricao, $2 = esperado, $3 = obtido
  if [ "$2" = "$3" ]; then echo "  ok    $1"
  else echo "  FALHA $1 (esperado $2, veio $3)"; falhas=$((falhas+1)); fi
}
conter() { # $1 = descricao, $2 = texto, $3 = trecho
  case "$2" in *"$3"*) echo "  ok    $1";; *) echo "  FALHA $1"; falhas=$((falhas+1));; esac
}

echo "1. dono da rota edita"
checar "dono passa" 0 "$(guard $DONO "$WRAIZ/src/motor.mjs")"

echo "2. outra sessao tenta"
checar "outro e bloqueado" 2 "$(guard $OUTRO "$WRAIZ/src/motor.mjs")"
conter "pedido aparece na mensagem" "$(cat "$BASE/err.txt")" "PEDIDO REGISTRADO"
[ -f "$RAIZ/docs/.rotas-pedidos.json" ] && echo "  ok    arquivo de pedidos criado" \
  || { echo "  FALHA arquivo de pedidos nao existe"; falhas=$((falhas+1)); }

echo "3. insistir nao duplica"
guard $OUTRO "$WRAIZ/src/motor.mjs" >/dev/null
N=$(FORCE_COLOR=0 NO_COLOR=1 node -e "console.log(JSON.parse(require('fs').readFileSync('$WRAIZ/docs/.rotas-pedidos.json','utf8')).pedidos.length)")
checar "um pedido so" 1 "$N"

echo "4. dono e avisado no fim do turno"
conter "dono avisado" "$(fim $DONO)" "autoriza"

echo "5. dono autoriza"
ID=$(pedidoId motor)
(cd "$RAIZ" && node "$H/rota-pedidos.mjs" autorizar "$ID" >/dev/null 2>&1)
checar "outro agora passa" 0 "$(guard $OUTRO "$WRAIZ/src/motor.mjs")"

echo "6. autorizacao e restrita"
checar "nao vale para outro arquivo" 2 "$(guard $OUTRO "$WRAIZ/src/outro.mjs")"
checar "nao vale para terceira sessao" 2 "$(guard $TERCEIRO "$WRAIZ/src/motor.mjs")"

echo "7. negar mantem bloqueado"
ID2=$(pedidoId outro)
(cd "$RAIZ" && node "$H/rota-pedidos.mjs" negar "$ID2" "estou nela" >/dev/null 2>&1)
checar "negado continua bloqueado" 2 "$(guard $OUTRO "$WRAIZ/src/outro.mjs")"

echo "8. projeto sem quadro nao e afetado"
checar "projeto sem Routia passa livre" 0 "$(guard $OUTRO "$WLIMPO/src/a.mjs")"

echo "9. docs continua livre mesmo com rota de outro"
echo "texto" > "$RAIZ/docs/algum.md"
checar "docs nao e bloqueado" 0 "$(guard $OUTRO "$WRAIZ/docs/algum.md")"

echo
[ $falhas -eq 0 ] && echo "TUDO PASSOU" || echo "$falhas FALHA(S)"
rm -rf "$RAIZ" "$LIMPO" "$BASE/err.txt"
exit $falhas
