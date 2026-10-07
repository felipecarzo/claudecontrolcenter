#!/bin/bash
# Instala a leitura segura do banco do Ahtleta (CC-944). Rode COMO ROOT, uma vez, e
# de novo depois de cada migração nova do banco (tabela nova só aparece assim).
#
#   sudo bash /home/claudedev/projetos/VPS_cockpit/tools/deploy-seguro/instalar-leitura.sh
#
# O que faz, e nada além disso:
#   1. cria no banco um usuário que só lê, sem as colunas pessoais (leitura-segura.sql)
#   2. guarda a senha dele em /etc/cockpit-leitura (de root; os agentes não leem)
#   3. confere de verdade: consulta treino passa, e-mail e escrita são recusados
#   4. copia o serviço para /opt/cockpit-leitura e liga no systemd (127.0.0.1:5194)
#   5. liga a página /leitura-segura/ no site do cockpit
# O código do autenticador é o mesmo do deploy seguro: precisa dele já instalado.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "rode como root (sudo bash $0)"; exit 1; }
AQUI=$(cd "$(dirname "$0")" && pwd)
ENV_SITE=${1:-/var/www/ahtleta/.env}
PAPEL=claude_leitura
[ -f /etc/cockpit-deploy/totp.secret ] || { echo "== falta o deploy seguro (o código do autenticador mora nele). Instale antes."; exit 1; }
[ -f "$ENV_SITE" ] || { echo "== não achei $ENV_SITE (passe o caminho do .env do Ahtleta no ar como primeiro argumento)"; exit 1; }

echo "== conferência do que vai ser instalado (compare com o que o Claude informou)"
sha256sum "$AQUI/leitura-segura.mjs" "$AQUI/leitura-segura.sql" "$AQUI/deploy-seguro.mjs"

install -d -m 700 /etc/cockpit-leitura
TMP=$(mktemp -d); chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
SENHA=$(openssl rand -hex 24)

# Lê o endereço do banco do .env do site e separa em variáveis: a senha nunca vai na
# linha de comando (que qualquer usuário da máquina vê), só em arquivo de root.
node --input-type=module - "$ENV_SITE" "$PAPEL" "$SENHA" "$TMP" <<'NODE'
import fs from 'node:fs'
const [arq, papel, senha, tmp] = process.argv.slice(2)
const env = Object.fromEntries(fs.readFileSync(arq, 'utf8').split('\n').map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]))
if (!env.DATABASE_URL) { console.error('== o .env não tem DATABASE_URL'); process.exit(1) }
const u = new URL(env.DATABASE_URL)
const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'"
const usuario = decodeURIComponent(u.username)
const pg = (user, pass) => [`PGHOST=${q(u.hostname)}`, `PGPORT=${q(u.port || '5432')}`, `PGDATABASE=${q(decodeURIComponent(u.pathname.slice(1)) || 'postgres')}`, `PGUSER=${q(user)}`, `PGPASSWORD=${q(pass)}`, `PGSSLMODE=${q(u.searchParams.get('sslmode') || 'prefer')}`].join('\n') + '\n'
fs.writeFileSync(tmp + '/dono.env', pg(usuario, decodeURIComponent(u.password)) + `EU_EMAIL=${q(env.ADMIN_EMAIL || '')}\n`, { mode: 0o600 })
// no pooler do Supabase o usuário vem como "papel.projeto": o novo segue o mesmo formato
const novo = usuario.includes('.') ? papel + usuario.slice(usuario.indexOf('.')) : papel
fs.writeFileSync(tmp + '/leitor.env', pg(novo, senha), { mode: 0o600 })
const l = new URL(env.DATABASE_URL); l.username = encodeURIComponent(novo); l.password = senha
fs.writeFileSync(tmp + '/banco', l.toString() + '\n', { mode: 0o600 })
NODE

comoDono() { ( set -a; . "$TMP/dono.env"; set +a; psql -X -q -v ON_ERROR_STOP=1 "$@" ); }
comoLeitor() { ( set -a; . "$TMP/leitor.env"; set +a; psql -X -q -t -A "$@" ); }

echo "== criando o usuário só de leitura no banco"
comoDono -v papel="$PAPEL" -v senha="$SENHA" -f "$AQUI/leitura-segura.sql" >/dev/null || { echo "== o banco recusou (o .env aponta para um banco que este usuário não administra?). Nada foi instalado. Me mande esta saída."; exit 1; }

echo "== conferindo as barreiras com o usuário novo"
N=$(comoLeitor -c "select count(*) from sessions_advanced") || { echo "== o usuário novo não conseguiu ler os treinos. Me mande esta saída."; exit 1; }
echo "   treinos visíveis: $N"
if comoLeitor -c "select email from profiles limit 1" >/dev/null 2>&1; then echo "== FALHOU: o usuário novo enxerga e-mail. Não instalei o serviço."; exit 1; fi
echo "   e-mail: recusado, como deve"
if comoLeitor -c "create table leitura_teste (x int)" >/dev/null 2>&1; then comoDono -c "drop table if exists leitura_teste" >/dev/null; echo "== FALHOU: o usuário novo consegue escrever. Não instalei o serviço."; exit 1; fi
echo "   escrita: recusada, como deve"

. <(grep '^EU_EMAIL=' "$TMP/dono.env")
EU=""
[ -n "$EU_EMAIL" ] && EU=$(echo "select user_id from profiles where lower(email) = lower(:'email') limit 1;" | comoDono -t -A -v email="$EU_EMAIL" -f - 2>/dev/null || true)
echo "   sua conta: ${EU:-não achei pelo ADMIN_EMAIL do site; os seus treinos vão aparecer sem marca}"

install -m 600 "$TMP/banco" /etc/cockpit-leitura/banco
install -d -m 755 /opt/cockpit-leitura
install -m 644 "$AQUI/leitura-segura.mjs" "$AQUI/deploy-seguro.mjs" /opt/cockpit-leitura/

# Usuário próprio do systemd (DynamicUser): nem root nem claudedev. As senhas chegam
# por LoadCredential, legíveis só por esse processo.
cat > /etc/systemd/system/cockpit-leitura.service <<UNIT
[Unit]
Description=Cockpit: leitura segura do banco do Ahtleta (libera com o autenticador)
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/cockpit-leitura/leitura-segura.mjs
Restart=always
RestartSec=3
DynamicUser=yes
StateDirectory=cockpit-leitura
LoadCredential=banco:/etc/cockpit-leitura/banco
LoadCredential=totp:/etc/cockpit-deploy/totp.secret
Environment=LEITURA_EU=$EU
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable cockpit-leitura >/dev/null
systemctl restart cockpit-leitura
sleep 1
curl -s -w "\n== serviço respondendo: %{http_code}\n" http://127.0.0.1:5194/api/estado || true

install -d -m 755 /etc/nginx/snippets
cat > /etc/nginx/snippets/cockpit-leitura.conf <<'NGINX'
# página para liberar a leitura do banco: servida pelo lado protegido, NÃO pelo cockpit.
# Só esta pasta passa: a consulta (/api/consultar) nunca sai da máquina.
location ^~ /leitura-segura/ {
    proxy_pass http://127.0.0.1:5194;
    proxy_set_header Host $host;
}
NGINX

SITE=$(grep -l "server_name[^;]*cockpit\.carzo\.com\.br" /etc/nginx/sites-enabled/* 2>/dev/null | head -1 || true)
if [ -z "$SITE" ]; then
  echo "== não achei o site do cockpit no nginx: inclua à mão a linha 'include snippets/cockpit-leitura.conf;' no bloco server dele"
elif grep -q "snippets/cockpit-leitura.conf" "$SITE"; then
  echo "== o nginx já inclui a página de leitura ($SITE)"
else
  cp -a "$SITE" "$SITE.antes-leitura"
  sed -i "/server_name[^;]*cockpit\.carzo\.com\.br/a\    include snippets/cockpit-leitura.conf;" "$SITE"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    echo "== página ligada: https://cockpit.carzo.com.br/leitura-segura/ (cópia do nginx antigo em $SITE.antes-leitura)"
  else
    cp -a "$SITE.antes-leitura" "$SITE"
    echo "== o teste do nginx falhou: devolvi o arquivo original, nada mudou no ar. Me mande esta saída."
  fi
fi
