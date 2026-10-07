# Cabeçalhos de segurança no nginx: o passo a passo para o administrador

CC-931. A medição de 07/10/2026 (`node cc.mjs seguranca varrer`) achou quatro endereços sem nenhum dos três cabeçalhos. O Claude não tem sudo e não mexe em nginx: quem instala é o Felipe, como administrador. O item CC-931 só fecha depois disso.

## O que a medição achou

| Endereço | O que falta | Causa |
| --- | --- | --- |
| `cockpit.carzo.com.br` | os três | o bloco no `dev-carzo` não declara nenhum `add_header` |
| `running.ahtleta.com.br` | os três | declarados no `server`, mas `location /` e `location /_expo/` têm `add_header Cache-Control`, e isso APAGA os herdados |
| `climbing.ahtleta.com.br` | os três | a mesma causa, nos mesmos dois `location` |
| `inovallbond.com.br` | os três | site desligado (responde 410), só tem `X-Robots-Tag`; baixa prioridade |

Já enviam os três: mnzs, entreg4, lev4, ahtleta.com.br, app.ahtleta, profinance, ibrics, fibraessencia, coepiloto, dengonator, ghoscode e pierre.

Três sites enviam o mesmo cabeçalho duas vezes (nginx e aplicação): `ibrics` (HSTS e nosniff), `profinance` (nosniff) e `coepiloto` (nosniff, e `X-Frame-Options` com DENY e SAMEORIGIN ao mesmo tempo). Funciona, mas é lixo. A cura é uma linha `proxy_hide_header` no nginx, no fim deste arquivo.

## A armadilha que explica o ahtleta

No nginx, `add_header` dentro de um `location` descarta todos os `add_header` do `server`. Quem declara os três no `server` e depois põe um `Cache-Control` num `location` fica sem os três naquela rota, sem erro nenhum. Por isso o trecho abaixo vai num arquivo só (snippet) e é incluído no `server` E dentro de cada `location` que tenha `add_header` próprio.

## Passo 1: criar o snippet (uma vez)

Arquivo novo `/etc/nginx/snippets/cabecalhos-seguranca.conf`, com este conteúdo exato:

```nginx
# CC-931: cabeçalhos mínimos do ASVS 4.0 nível 1 (V14.4.4, V14.4.5, V14.4.7).
# Incluir no server e dentro de cada location que tenha add_header próprio.
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Content-Security-Policy "frame-ancestors 'self'" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Escolhas, e o motivo de cada uma:

- HSTS sem `includeSubDomains` e sem `preload`: os dois são difíceis de desfazer e o domínio `carzo.com.br` tem muitos subdomínios de gente diferente. Podem entrar depois, site a site.
- O CSP só traz `frame-ancestors 'self'`: não restringe script nem imagem, então não quebra página nenhuma. É a parte do CSP que o ASVS pede (V14.4.7).
- `X-Frame-Options SAMEORIGIN` repete o `frame-ancestors` para navegador antigo. O escritório do cockpit embute `/painel/<id>/` na mesma origem, então `'self'` basta.
- Não use o `snippets/security.conf` que já existe no cockpit: o CSP dele (`default-src 'self' http: https: data: blob: 'unsafe-inline'`) pode bloquear o WebSocket do painel.

## Passo 2: incluir no cockpit

Em `/etc/nginx/sites-enabled/dev-carzo`, no bloco `server` do `cockpit.carzo.com.br` (o que já tem `include snippets/cockpit-deploy.conf;`), logo abaixo do `server_name`:

```nginx
server {
    server_name cockpit.carzo.com.br;
    include snippets/cabecalhos-seguranca.conf;   # NOVO
    include snippets/cockpit-deploy.conf;
    ...
```

Os dois `location` desse bloco não têm `add_header`, então a inclusão no `server` basta. O `location ^~ /deploy-seguro/` do `cockpit-deploy.conf` também não tem.

## Passo 3: incluir no Ahtleta (running e climbing)

Em `/etc/nginx/sites-enabled/running.ahtleta.com.br` e em `/etc/nginx/sites-enabled/climbing.ahtleta.com.br`, no bloco da porta 443: troque as três linhas `add_header` de segurança do `server` por uma inclusão, e repita a inclusão dentro dos dois `location` que têm `Cache-Control`:

```nginx
    include snippets/cabecalhos-seguranca.conf;   # no server, no lugar dos 3 add_header antigos

    location /_expo/ {
        include snippets/cabecalhos-seguranca.conf;   # NOVO: sem isso a rota perde os cabeçalhos
        add_header Cache-Control "public, max-age=31536000, immutable";
        ...
    }

    location / {
        include snippets/cabecalhos-seguranca.conf;   # NOVO
        add_header Cache-Control "no-cache";
        ...
    }
```

Atenção: dentro de um `location` que tem `add_header Cache-Control`, a inclusão precisa estar no mesmo `location`, não só no `server`. O `location /api/` não tem `add_header` e herda do `server`.

## Passo 4: aplicar

Como administrador (os comandos de `nginx -t` e `reload` precisam de root):

```bash
sudo nginx -t
sudo systemctl reload nginx
```

- `sudo`: roda como administrador (superuser do).
- `nginx -t`: testa a configuração sem aplicar (`-t` = test). Se disser "syntax is ok" e "test is successful", pode seguir. Se falhar, não faça o reload.
- `systemctl reload nginx`: manda o nginx reler a configuração sem derrubar conexão (`systemctl` controla serviços do systemd).

## Passo 5: conferir

Pode ser feito pelo Claude, sem sudo, de qualquer sessão:

```bash
node cc.mjs seguranca varrer --projeto cockpit
node cc.mjs seguranca varrer --projeto ahtleta-corrida
node cc.mjs seguranca varrer --projeto ahtleta-escalada
```

- `node cc.mjs`: roda o comando do painel.
- `seguranca varrer`: a varredura ASVS, só leitura.
- `--projeto X`: só esse projeto (o prefixo `VPS_` é opcional).

O relatório em `docs/seguranca/<projeto>.md` deve trazer V14.4.4, V14.4.5 e V14.4.7 em "O que cumpre", com o cabeçalho recebido como prova. Se algum continuar em "não cumpre", é um `location` com `add_header` próprio que ficou sem a inclusão. Ao ver os três verdes nos três endereços, o item CC-931 pode ser fechado.

Atalho de conferência manual, também sem sudo:

```bash
curl -sI https://cockpit.carzo.com.br/ | grep -i "strict-transport\|x-content-type\|x-frame\|frame-ancestors"
```

- `curl`: baixa uma URL.
- `-s`: silencioso (sem barra de progresso).
- `-I`: pede só os cabeçalhos (HEAD).
- `|`: manda a saída do curl para o próximo comando.
- `grep -i "a\|b"`: filtra as linhas que contêm qualquer um dos termos, ignorando maiúscula (`-i`, ignore case; `\|` é "ou").

## Opcional: tirar a duplicata de ibrics, profinance e coepiloto

Nesses três o nginx e a aplicação mandam o mesmo cabeçalho. Para o nginx mandar só o dele, dentro do `location` que faz `proxy_pass`:

```nginx
proxy_hide_header X-Content-Type-Options;
proxy_hide_header Strict-Transport-Security;
proxy_hide_header X-Frame-Options;
```

No `coepiloto`, o conflito `DENY` mais `SAMEORIGIN` pede escolher um dos dois: o navegador trata valores conflitantes como DENY, e se o coepiloto precisa ser embutido isso quebra. Decisão dele.
