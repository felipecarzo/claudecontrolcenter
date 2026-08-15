#!/bin/bash
# Gate do CC-84: dois agentes se falando sem se atropelar.
H="$(dirname "$0")/recados.mjs"
[ -f "$H" ] || H="/home/claudedev/projetos/proj_controlcenter/hooks/routia/recados.mjs"
P=$(mktemp -d); mkdir -p "$P/docs"; echo "# rotas" > "$P/docs/ROTAS-ATIVAS.md"
ok=0; falhou=0
checa() { if [ "$2" = "$3" ]; then echo "  ok   $1"; ok=$((ok+1)); else echo "  FALHOU $1 (esperado=$3 veio=$2)"; falhou=$((falhou+1)); fi; }
bate()  { if echo "$2" | grep -q "$3"; then echo "  ok   $1"; ok=$((ok+1)); else echo "  FALHOU $1"; falhou=$((falhou+1)); fi; }

# projeto sem Routia: silêncio total, nunca atrapalha
VAZIO=$(mktemp -d)
echo "{\"cwd\":\"$VAZIO\"}" | CLAUDE_CODE_SESSION_ID=aaaaaaaa node "$H" >/dev/null 2>&1
checa "projeto sem quadro de rotas nao e interrompido" "$?" "0"

# sem recado nenhum, também não interrompe
echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=aaaaaaaa node "$H" >/dev/null 2>&1
checa "caixa vazia nao interrompe" "$?" "0"

CLAUDE_CODE_SESSION_ID=aaaaaaaa node "$H" enviar bbbbbbbb vou_mexer "mexo no platform" --dir "$P" >/dev/null

SAIDA=$(echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=bbbbbbbb node "$H" 2>&1); C=$?
checa "o destinatario e interrompido uma vez" "$C" "2"
bate  "e o recado aparece inteiro" "$SAIDA" "mexo no platform"
bate  "com o que ele deve fazer" "$SAIDA" "responda com"

echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=bbbbbbbb node "$H" >/dev/null 2>&1
checa "a ferramenta seguinte NAO e interrompida" "$?" "0"

echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=aaaaaaaa node "$H" >/dev/null 2>&1
checa "quem mandou nao recebe o proprio recado" "$?" "0"

CLAUDE_CODE_SESSION_ID=cccccccc node "$H" enviar todos aviso "aviso geral" --dir "$P" >/dev/null
echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=aaaaaaaa node "$H" >/dev/null 2>&1
checa "recado para todos alcanca terceiros" "$?" "2"

# arquivo corrompido: falha ABERTA, nunca trava os dois agentes
echo "nao e json" > "$P/docs/.recados.json"
echo "{\"cwd\":\"$P\"}" | CLAUDE_CODE_SESSION_ID=dddddddd node "$H" >/dev/null 2>&1
checa "arquivo corrompido nao trava ninguem" "$?" "0"

bate "tipo invalido e recusado" "$(CLAUDE_CODE_SESSION_ID=a node "$H" enviar b xpto "t" --dir "$P" 2>&1)" "tipo desconhecido"

rm -rf "$P" "$VAZIO"
echo; echo "recados: $ok ok, $falhou falharam"
[ "$falhou" -eq 0 ]
