#!/bin/bash
# Instala a porta de entrada do painel com o segundo fator (CC-869). Rode COMO ROOT.
#
#   sudo bash /home/claudedev/projetos/VPS_cockpit/tools/porta-entrada/instalar.sh
#
# O que faz, e nada além disso:
#   1. confere a sintaxe dos arquivos ANTES de tocar em qualquer coisa
#   2. guarda cópia do que está instalado (cockpit-auth.mjs e cockpit-auth-cli.mjs)
#   3. copia os arquivos (e a lista de sites que o vigia mede) para /home/claudedev, com o dono certo (claudedev)
#   4. reinicia o serviço cockpit-auth e confere que ele respondeu
#   5. se NÃO respondeu, devolve a cópia antiga e reinicia de novo
#
# O código do autenticador nasce DESLIGADO: nada muda para você até rodar
# `codigo ligar`, que testa a conexão com o Deploy seguro antes de ligar.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root (sudo bash $0)"; exit 1; }
AQUI=$(cd "$(dirname "$0")" && pwd)
DEST=/home/claudedev
ARQS="cockpit-auth.mjs cockpit-auth-cli.mjs segundo-fator.mjs push.mjs vigia.mjs"   # CC-932: push.mjs e vigia.mjs são os avisos de queda no celular

echo "== conferência do que vai ser instalado (compare com o que o Claude informou)"
for f in $ARQS; do sha256sum "$AQUI/$f"; done
sha256sum "$AQUI/../auditoria/auditoria.mjs" "$AQUI/../app-seguranca/app-seguranca.mjs"

echo "== sintaxe"
for f in $ARQS; do node --check "$AQUI/$f"; done
node --check "$AQUI/../auditoria/auditoria.mjs"; node --check "$AQUI/../app-seguranca/app-seguranca.mjs"
echo "ok"

bash "$AQUI/../auditoria/instalar.sh"   # CC-933: o registro central de auditoria

AGORA=$(date +%Y%m%d%H%M%S)
for f in cockpit-auth.mjs cockpit-auth-cli.mjs push.mjs vigia.mjs auditoria.mjs app-seguranca.mjs; do
  [ -f "$DEST/$f" ] && cp -a "$DEST/$f" "$DEST/$f.antes-$AGORA"
done
for f in $ARQS; do install -o claudedev -g claudedev -m 644 "$AQUI/$f" "$DEST/$f"; done
install -o claudedev -g claudedev -m 644 "$AQUI/../auditoria/auditoria.mjs" "$DEST/auditoria.mjs"
install -o claudedev -g claudedev -m 644 "$AQUI/../app-seguranca/app-seguranca.mjs" "$DEST/app-seguranca.mjs"   # CC-859: manifesto, ícone e service worker do app

# CC-932: a lista de sites que o vigia mede (nome e endereço, nada mais). A porta roda como claudedev e não
# lê /etc/cockpit-deploy, então o administrador grava uma cópia aqui. Sem a lista de lá, usa a do repositório.
ORIG=/etc/cockpit-deploy/alvos.json; [ -f "$ORIG" ] || ORIG="$AQUI/../deploy-seguro/alvos.json"
node -e 'const l=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(JSON.stringify(l.filter(a=>a&&a.url).map(a=>({nome:a.nome||a.id,url:a.url})),null,1))' "$ORIG" > "$DEST/.cockpit-vigia-alvos.json.novo"
install -o claudedev -g claudedev -m 644 "$DEST/.cockpit-vigia-alvos.json.novo" "$DEST/.cockpit-vigia-alvos.json"; rm -f "$DEST/.cockpit-vigia-alvos.json.novo"
echo "vigia: $(grep -c '"url"' "$DEST/.cockpit-vigia-alvos.json") site(s) com endereço público, mais o painel"

echo "== reiniciando o serviço da porta de entrada"
systemctl restart cockpit-auth
sleep 3
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5181/ || true)
if [ "$CODIGO" = 401 ] || [ "$CODIGO" = 200 ] || [ "$CODIGO" = 302 ]; then
  echo "respondeu (HTTP $CODIGO). Instalado."
  echo
  echo "Avisos de queda: no celular, Ajustes > Avisos no celular > Ligar avisos, e Mandar um aviso de teste."
  echo
  echo "Próximo passo, quando quiser ligar o código do autenticador:"
  echo "  sudo -u claudedev -H node $DEST/cockpit-auth-cli.mjs codigo ligar"
else
  echo "NÃO respondeu (HTTP '$CODIGO'). Devolvendo a versão anterior."
  for f in cockpit-auth.mjs cockpit-auth-cli.mjs push.mjs vigia.mjs auditoria.mjs app-seguranca.mjs; do
    [ -f "$DEST/$f.antes-$AGORA" ] && install -o claudedev -g claudedev -m 644 "$DEST/$f.antes-$AGORA" "$DEST/$f"
  done
  systemctl restart cockpit-auth
  echo "versão anterior de volta. Veja: journalctl -u cockpit-auth -n 30"
  exit 1
fi
