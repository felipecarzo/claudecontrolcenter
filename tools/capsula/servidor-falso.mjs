// CC-1080, passo 3: o servidor FALSO dos testes da cápsula. Nada aqui encosta em /etc, /opt, /var/www nem em programa de verdade.
// Cria, dentro de uma pasta temporária: uma pasta do nginx com 3 projetos de blocos (e um de outro dono que NÃO pode entrar),
// quatro projetos em disco, PM2, crontab e unidades falsos, e uma pasta de binários falsos (nginx, certbot, pm2, crontab,
// systemctl, id) que registram cada chamada num log.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export const SEGREDOS = {
  nginx: 'SEGREDO-NGINX-123', env: 'senha-env-alfa-nao-pode', pm2: 'valor-env-pm2-secreto', unidade: 'unit-secreto-xyz',
  cron: 'abc123segredocron', htpasswd: 'SEGREDO-HTPASSWD-ALFA', externo: 'externo-secreto-777',
  // dentro das pastas publicadas do projeto delta: NUNCA podem entrar num tar
  chavePem: 'CHAVE-PRIVADA-PEM-NAO-VAZAR-555', envPublicado: 'env-dentro-do-publicado-NAO-VAZAR', idRsa: 'ID-RSA-NAO-VAZAR-777',
}

export function criarServidorFalso(T) {
  const base = path.join(T, 'srv')
  const nginxDir = path.join(base, 'nginx')
  const av = path.join(nginxDir, 'sites-available'), en = path.join(nginxDir, 'sites-enabled')
  for (const d of [av, en, path.join(nginxDir, 'snippets')]) fs.mkdirSync(d, { recursive: true })
  const w = (f, t, modo) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); if (modo !== undefined) fs.chmodSync(f, modo) }
  const liga = (nome, alvo = nome) => fs.symlinkSync(path.join('..', 'sites-available', alvo), path.join(en, nome)) // atalho RELATIVO: nunca aponta para o /etc de verdade

  w(path.join(nginxDir, 'snippets', 'security.conf'), 'add_header X-Frame-Options "SAMEORIGIN" always;\n')
  w(path.join(nginxDir, '.htpasswd-alfa'), `alfa:$apr1$${SEGREDOS.htpasswd}\n`, 0o640)
  w(path.join(nginxDir, '.htpasswd-trancado'), 'x:y\n', 0o000)

  // alfa: proxy por porta (a do .env), bloco certbot com SSL, desvio de http, cabeçalho com segredo, atalho duplicado
  w(path.join(av, 'alfa'), `server {
    listen 80;
    server_name alfa.exemplo.com;
    return 301 https://$host$request_uri; # managed by Certbot
}

server {
    listen 443 ssl; # managed by Certbot
    server_name alfa.exemplo.com;
    include snippets/security.conf;
    location / {
        proxy_pass http://127.0.0.1:8101;
        proxy_set_header Host $host;
        proxy_set_header Authorization "Bearer ${SEGREDOS.nginx}";
    }
    ssl_certificate /etc/letsencrypt/live/alfa.exemplo.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/alfa.exemplo.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}
`)
  // alfa-estatico: root em /var/www/<nome>, com dois arquivos de senha (um legível, um que só o root lê)
  w(path.join(av, 'alfa-estatico'), `server {
    listen 80;
    server_name estatico.alfa.exemplo.com;
    root /var/www/alfa;
    auth_basic "area";
    auth_basic_user_file ${path.join(nginxDir, '.htpasswd-alfa')};
    location /admin/ {
        auth_basic_user_file ${path.join(nginxDir, '.htpasswd-trancado')};
    }
}
`)
  // beta: upstream + porta do .env
  w(path.join(av, 'beta'), `upstream beta_up {
    server 127.0.0.1:8202 max_fails=0;
}
server {
    listen 80;
    server_name beta.exemplo.com;
    location / { proxy_pass http://beta_up; }
}
`)
  // gama: tudo CANDIDATO (porta só no package.json, nome parecido, domínio citado no README)
  w(path.join(av, 'gama'), 'server {\n    listen 80;\n    server_name gama-app.exemplo.com;\n    location / { proxy_pass http://127.0.0.1:9303; }\n}\n')
  w(path.join(av, 'gama-landing'), 'server {\n    listen 80;\n    server_name pagina.exemplo.com;\n    root /var/www/gama-landing;\n}\n')
  w(path.join(av, 'gama-citado'), 'server {\n    listen 80;\n    server_name gama.exemplo.com;\n    location / { return 200 "oi"; }\n}\n')
  // zeta: só a porta que o Docker mostra
  w(path.join(av, 'zeta'), 'server {\n    listen 80;\n    server_name zeta.exemplo.com;\n    location / { proxy_pass http://localhost:8303; }\n}\n')
  // fe-teste: a porta 3055 que o Docker falso do passo 2 publica
  w(path.join(av, 'fe-teste'), 'server {\n    listen 80;\n    server_name fe.exemplo.com;\n    location / { proxy_pass http://127.0.0.1:3055; }\n}\n')
  // delta: o site PUBLICADO. Porta do .env (8404) liga o bloco como "certo"; o root e dois alias ficam FORA do projeto, em pastas falsas
  // da casa temporária (nunca em /var/www de verdade). promo.delta é só citado no README: candidato, com a pasta dele.
  const www = path.join(base, 'www')
  w(path.join(av, 'delta'), `server {
    listen 80;
    server_name delta.exemplo.com;
    root ${www}/delta-publico;
    location /midia/ { alias ${www}/delta-midia/; }
    location /priv/ { alias ${www}/delta-trancado/; }
    location /api { proxy_pass http://127.0.0.1:8404; }
}
`)
  w(path.join(av, 'delta-promo'), `server {\n    listen 80;\n    server_name promo.delta.exemplo.com;\n    root ${www}/delta-promo;\n}\n`)
  // ruído: comum.exemplo.com é citado em 3 projetos (delta, eps1, eps2); dois.exemplo.com só em 2 (delta, eps1)
  w(path.join(av, 'comum'), 'server {\n    listen 80;\n    server_name comum.exemplo.com;\n    location / { return 200 "oi"; }\n}\n')
  w(path.join(av, 'dois'), 'server {\n    listen 80;\n    server_name dois.exemplo.com;\n    location / { return 200 "oi"; }\n}\n')
  // de OUTRO projeto: nada disto pode entrar em cápsula nenhuma dos quatro
  w(path.join(av, 'outro'), 'server {\n    listen 80;\n    server_name outro.exemplo.com;\n    root /var/www/outro;\n    location /api { proxy_pass http://127.0.0.1:7777; }\n}\n')
  for (const n of ['alfa', 'alfa-estatico', 'beta', 'gama', 'gama-landing', 'gama-citado', 'zeta', 'fe-teste', 'outro', 'delta', 'delta-promo', 'comum', 'dois']) liga(n)
  liga('alfa-antigo', 'alfa')
  // um bloco que não é link: arquivo solto em sites-enabled, de outro dono
  w(path.join(en, 'solto'), 'server {\n    listen 80;\n    server_name solto.exemplo.com;\n    root /var/www/solto;\n}\n')

  // os projetos em disco
  const projs = path.join(T, 'projs')
  const alfa = path.join(projs, 'VPS_alfa'), beta = path.join(projs, 'VPS_beta'), gama = path.join(projs, 'VPS_gama'), zeta = path.join(projs, 'VPS_zeta')
  w(path.join(alfa, '.env'), `PORT=8101\nDB_PASSWORD=${SEGREDOS.env}\n`)
  w(path.join(alfa, 'server.js'), 'console.log("alfa")\n')
  w(path.join(alfa, 'package.json'), '{"name":"alfa","scripts":{"start":"node server.js"}}\n')
  w(path.join(beta, '.env'), 'PORT=8202\n')
  w(path.join(beta, 'package.json'), '{"name":"beta"}\n')
  w(path.join(gama, 'package.json'), '{"name":"gama","scripts":{"dev":"next dev -p 9303"}}\n')
  w(path.join(gama, 'README.md'), '# gama\nO site fica em gama.exemplo.com.\n')
  w(path.join(zeta, 'package.json'), '{"name":"zeta"}\n')
  // delta e os dois projetos que citam o mesmo domínio
  const delta = path.join(projs, 'VPS_delta'), eps1 = path.join(projs, 'VPS_eps1'), eps2 = path.join(projs, 'VPS_eps2')
  w(path.join(delta, '.env'), 'PORT=8404\nSEGREDO_DELTA=senha-env-delta-nao-pode\n')
  w(path.join(delta, 'package.json'), '{"name":"delta"}\n')
  w(path.join(delta, 'README.md'), '# delta\nSite: delta.exemplo.com. Promoção: promo.delta.exemplo.com. Também: comum.exemplo.com e dois.exemplo.com.\n')
  w(path.join(eps1, 'README.md'), '# eps1\nUsa comum.exemplo.com e dois.exemplo.com.\n')
  w(path.join(eps2, 'README.md'), '# eps2\nUsa comum.exemplo.com.\n')
  // as pastas publicadas do delta (fora do projeto)
  w(path.join(www, 'delta-publico', 'index.html'), '<h1>delta</h1>\n')
  w(path.join(www, 'delta-publico', 'css', 'site.css'), 'body { color: #123; }\n')
  w(path.join(www, 'delta-publico', 'uploads', 'foto.txt'), 'foto do cliente\n')
  w(path.join(www, 'delta-publico', '.env'), `X=${SEGREDOS.envPublicado}\n`)
  w(path.join(www, 'delta-publico', 'certs', 'privkey.pem'), `${SEGREDOS.chavePem}\n`)
  w(path.join(www, 'delta-publico', 'id_rsa'), `${SEGREDOS.idRsa}\n`)
  w(path.join(www, 'delta-publico', 'trancado.dat'), 'do root\n', 0o000)
  w(path.join(www, 'delta-midia', 'a.txt'), 'midia a\n')
  w(path.join(www, 'delta-trancado', 'x.txt'), 'x\n'); fs.chmodSync(path.join(www, 'delta-trancado'), 0o000)
  w(path.join(www, 'delta-promo', 'p.txt'), 'promo\n')

  // PM2 falso: um processo do alfa (com valores de variável que NÃO podem sair) e um de outro dono
  const pm2Lista = [
    { name: 'alfa-web', pm2_env: { pm_cwd: alfa, pm_exec_path: path.join(alfa, 'server.js'), args: ['--port', '8101'], exec_interpreter: 'node', exec_mode: 'fork_mode', env: { PORT: '8101', DB_PASSWORD: SEGREDOS.pm2, PATH: '/usr/bin', API_TOKEN: SEGREDOS.pm2 } } },
    { name: 'outro-app', pm2_env: { pm_cwd: '/opt/outro', pm_exec_path: '/opt/outro/app.js', args: [], env: { PORT: '7777' } } },
  ]
  const pm2 = () => ({ ok: true, lista: pm2Lista })
  const crontab = () => ({ ok: true, texto: `# comentario\n0 3 * * * cd ${alfa} && ./backup.sh\n*/5 * * * * TOKEN=${SEGREDOS.cron} ${alfa}/job.sh\n* * * * * /opt/outro/faz.sh\n` })

  // unidades de usuário falsas
  const unitDir = path.join(base, 'units')
  const ext = path.join(base, 'ext.env')
  w(ext, `X=${SEGREDOS.externo}\n`, 0o600)
  w(path.join(unitDir, 'alfa.service'), `[Service]\nWorkingDirectory=${alfa}\nExecStart=/usr/bin/node server.js\nEnvironment=PORT=8101\nEnvironment=API_KEY=${SEGREDOS.unidade}\nEnvironmentFile=${ext}\n`)
  w(path.join(unitDir, 'alfa.timer'), '[Timer]\nOnCalendar=daily\n')
  w(path.join(unitDir, 'outro.service'), '[Service]\nWorkingDirectory=/opt/outro\nExecStart=/usr/bin/node app.js\n')

  const readers = { nginxDir, unitDir, pm2, crontab }
  // o teste precisa devolver o modo da pasta trancada antes de apagar a casa temporária
  const destrancar = () => { try { fs.chmodSync(path.join(www, 'delta-trancado'), 0o755) } catch { /* já sumiu */ } try { fs.chmodSync(path.join(www, 'delta-publico', 'trancado.dat'), 0o644) } catch { /* idem */ } }
  return { base, www, nginxDir, av, en, alfa, beta, gama, zeta, delta, eps1, eps2, readers, ext, SEGREDOS, destrancar }
}

/** Uma pasta de binários FALSOS, com os utilitários de base como atalhos. O PATH do teste é SÓ ela: nada de verdade roda. */
export function criarBinariosFalsos(T, nomeDir = 'bin-servidor') {
  const bin = path.join(T, nomeDir); fs.mkdirSync(bin, { recursive: true })
  const dados = path.join(T, nomeDir + '-dados'); fs.mkdirSync(dados, { recursive: true })
  const log = path.join(dados, 'chamadas.log')
  for (const f of ['sh', 'tar', 'gzip', 'sed', 'grep', 'cut', 'head', 'tail', 'ls', 'find', 'wc', 'mktemp', 'sha256sum', 'dirname', 'cat', 'rm', 'mkdir', 'sleep', 'gpg', 'openssl', 'git', 'stty', 'cp', 'mv', 'ln', 'chmod', 'tr', 'basename', 'rmdir', 'diff', 'cmp']) {
    const r = spawnSync('sh', ['-c', `command -v ${f}`], { encoding: 'utf8' })
    const p = r.stdout.trim()
    if (p && !fs.existsSync(path.join(bin, f))) fs.symlinkSync(p, path.join(bin, f))
  }
  const fake = (nome, corpo) => fs.writeFileSync(path.join(bin, nome), `#!/bin/sh\n${corpo}\n`, { mode: 0o755 })
  fake('id', 'if [ "$1" = "-u" ]; then echo "${FALSO_UID:-1000}"; else echo "uid=${FALSO_UID:-1000}"; fi')
  fake('nginx', `echo "nginx $*" >> "$FALSO_LOG"
case "$1" in
  -t)
    [ -f "$FALSO_DADOS/nginx-t-falha" ] && { echo "nginx: [emerg] erro de teste do nginx falso" >&2; exit 1; }
    if [ -f "$FALSO_DADOS/nginx-t-exige-sem-ssl" ] && grep -l 'ssl_certificate' "$FALSO_ND"/sites-enabled/* >/dev/null 2>&1; then
      echo "nginx: [emerg] cannot load certificate (falso)" >&2; exit 1
    fi
    exit 0 ;;
  -s) exit 0 ;;
esac
exit 0`)
  fake('certbot', 'echo "certbot $*" >> "$FALSO_LOG"; exit 0')
  fake('systemctl', 'echo "systemctl $*" >> "$FALSO_LOG"; exit 0')
  fake('pm2', `echo "pm2 $*" >> "$FALSO_LOG"
if [ "$1" = "describe" ]; then [ -f "$FALSO_DADOS/pm2-existe-$2" ] && exit 0; exit 1; fi
exit 0`)
  fake('crontab', `echo "crontab $*" >> "$FALSO_LOG"
if [ "$1" = "-l" ]; then [ -f "$FALSO_DADOS/crontab" ] && { cat "$FALSO_DADOS/crontab"; exit 0; }; echo "no crontab" >&2; exit 1; fi
cp "$1" "$FALSO_DADOS/crontab"; exit 0`)
  return {
    bin, dados, log,
    linhas: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []),
    zerar: () => fs.rmSync(log, { force: true }),
    arquivo: (nome, conteudo) => { const f = path.join(dados, nome); if (conteudo === null) fs.rmSync(f, { force: true }); else fs.writeFileSync(f, conteudo) },
    env: (nd, uid = 1000, extra = {}) => ({ PATH: bin, FALSO_LOG: log, FALSO_DADOS: dados, FALSO_ND: nd, FALSO_UID: String(uid), ...extra }),
  }
}
