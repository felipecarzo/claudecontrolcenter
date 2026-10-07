#!/bin/bash
# Instala o lado protegido do deploy (CC-789). Rode COMO ROOT, uma vez, e de
# novo só quando quiser atualizar o serviço. Os agentes não conseguem rodar isto.
#
#   sudo bash /home/claudedev/projetos/VPS_cockpit/tools/deploy-seguro/instalar.sh
#
# O que faz, e nada além disso:
#   1. copia o serviço para /opt/cockpit-deploy (de root; os agentes não alteram)
#   2. cria /etc/cockpit-deploy com a lista de alvos e o segredo do autenticador
#   3. liga o serviço no systemd (só escuta em 127.0.0.1:5193)
#   4. cria o trecho do nginx para a página /deploy-seguro/ (você inclui no site do cockpit)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root (sudo bash $0)"; exit 1; }
AQUI=$(cd "$(dirname "$0")" && pwd)

echo "== conferência do que vai ser instalado (compare com o que o Claude informou)"
sha256sum "$AQUI/deploy-seguro.mjs" "$AQUI/../auditoria/auditoria.mjs" "$AQUI/../app-seguranca/app-seguranca.mjs"
node --check "$AQUI/deploy-seguro.mjs"; node --check "$AQUI/../auditoria/auditoria.mjs"; node --check "$AQUI/../app-seguranca/app-seguranca.mjs"

bash "$AQUI/../auditoria/instalar.sh"   # CC-933: o registro central de auditoria
install -d -m 755 /opt/cockpit-deploy
# guarda a versão anterior do serviço: se a nova não subir, é daqui que se volta
AGORA=$(date +%Y%m%d%H%M%S)
for f in deploy-seguro.mjs auditoria.mjs app-seguranca.mjs; do [ -f "/opt/cockpit-deploy/$f" ] && cp -a "/opt/cockpit-deploy/$f" "/opt/cockpit-deploy/$f.antes-$AGORA"; done
install -m 644 "$AQUI/deploy-seguro.mjs" /opt/cockpit-deploy/deploy-seguro.mjs
install -m 644 "$AQUI/../auditoria/auditoria.mjs" /opt/cockpit-deploy/auditoria.mjs
install -m 644 "$AQUI/../app-seguranca/app-seguranca.mjs" /opt/cockpit-deploy/app-seguranca.mjs   # CC-859: manifesto, ícone e service worker do app
install -d -m 700 /etc/cockpit-deploy /var/lib/cockpit-deploy /var/backups/cockpit-deploy
# a lista de sites sai do repositório (que os agentes editam): na troca, mostra o que muda e pergunta
if [ ! -f /etc/cockpit-deploy/alvos.json ]; then
  install -m 600 "$AQUI/alvos.json" /etc/cockpit-deploy/alvos.json
elif ! cmp -s "$AQUI/alvos.json" /etc/cockpit-deploy/alvos.json; then
  echo; echo "== a lista de sites mudou. O que entra (+) e o que sai (-):"
  diff -u /etc/cockpit-deploy/alvos.json "$AQUI/alvos.json" | sed '1,2d' || true
  read -r -p "== aplicar a lista nova? (s/n) " R
  if [ "$R" = s ]; then cp -a /etc/cockpit-deploy/alvos.json "/etc/cockpit-deploy/alvos.json.antes-$(date +%Y%m%d%H%M%S)"; install -m 600 "$AQUI/alvos.json" /etc/cockpit-deploy/alvos.json; echo "== lista nova aplicada"; else echo "== lista mantida como estava"; fi
fi

NOVO=0
if [ ! -f /etc/cockpit-deploy/totp.secret ]; then
  node --input-type=module -e "import c from 'node:crypto'; import {base32Codificar} from '/opt/cockpit-deploy/deploy-seguro.mjs'; process.stdout.write(base32Codificar(c.randomBytes(20)))" > /etc/cockpit-deploy/totp.secret
  chmod 600 /etc/cockpit-deploy/totp.secret
  NOVO=1
fi

cat > /etc/systemd/system/cockpit-deploy.service <<'UNIT'
[Unit]
Description=Cockpit: lado protegido do deploy (confirma com o autenticador)
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/cockpit-deploy/deploy-seguro.mjs
Environment=COCKPIT_AUDITORIA=/var/log/cockpit/auditoria.jsonl
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable cockpit-deploy >/dev/null
systemctl restart cockpit-deploy
sleep 1
curl -s -o /dev/null -w "== serviço respondendo: %{http_code}\n" http://127.0.0.1:5193/api/alvos || true

install -d -m 755 /etc/nginx/snippets
cat > /etc/nginx/snippets/cockpit-deploy.conf <<'NGINX'
# página de confirmação do deploy: servida pelo lado protegido, NÃO pelo cockpit
location ^~ /deploy-seguro/ {
    proxy_pass http://127.0.0.1:5193;
    proxy_set_header Host $host;
}
NGINX

# liga a página no site do cockpit: cópia antes, teste do nginx, e volta ao original se o teste falhar
SITE=$(grep -l "server_name[^;]*cockpit\.carzo\.com\.br" /etc/nginx/sites-enabled/* 2>/dev/null | head -1 || true)
if [ -z "$SITE" ]; then
  echo "== não achei o site do cockpit no nginx: inclua à mão a linha 'include snippets/cockpit-deploy.conf;' no bloco server dele"
elif grep -q "snippets/cockpit-deploy.conf" "$SITE"; then
  echo "== o nginx já inclui a página de deploy ($SITE)"
else
  cp -a "$SITE" "$SITE.antes-deploy"
  sed -i "/server_name[^;]*cockpit\.carzo\.com\.br/a\    include snippets/cockpit-deploy.conf;" "$SITE"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "== página ligada: https://cockpit.carzo.com.br/deploy-seguro/ (cópia do nginx antigo em $SITE.antes-deploy)"
  else
    cp -a "$SITE.antes-deploy" "$SITE"
    echo "== o teste do nginx falhou: devolvi o arquivo original, nada mudou no ar. Me mande esta saída."
  fi
fi

if [ "$NOVO" = 1 ]; then
  S=$(cat /etc/cockpit-deploy/totp.secret)
  echo
  echo "== SEGREDO DO AUTENTICADOR (aparece só agora; não fica salvo em lugar nenhum fora de /etc/cockpit-deploy):"
  echo "   no app autenticador do celular: adicionar conta > inserir chave de configuração"
  echo "   nome: Cockpit deploy    chave: $S    tipo: baseado em tempo"
  echo "   ou, se o app aceitar link: otpauth://totp/Cockpit:deploy?secret=$S&issuer=Cockpit"
fi
