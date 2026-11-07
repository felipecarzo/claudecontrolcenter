# Tradutor: abrir o servidor para o celular (nginx, precisa de root)

O servidor de tradução (`tools/tradutor/tradutor.py`) já roda na VPS como serviço de usuário
(`tradutor.service`) e escuta só em `127.0.0.1:8790`. O celular precisa de um endereço público.
Isso é uma regra de nginx, e só o root pode colocar.

## Ponto que não pode errar

O `cockpit-auth` (porta 5181) exige **cookie de sessão** do painel. O app Tradutor usa **Bearer token**
e não tem cookie. Então o `location` do tradutor deve ir **direto para a 8790**, **fora do `cockpit-auth`**.
Se passar pelo `cockpit-auth`, toda chamada do app volta pedindo login. A proteção do tradutor é o
token (arquivo `~/.tradutor-token`, modo 600) mais o teto de 300 traduções por hora.

## Forma 1: no mesmo domínio, `cockpit.carzo.com.br`

Dentro do `server { ... }` HTTPS de `cockpit.carzo.com.br`, **antes** do `location /` que manda para a 5181:

```nginx
location /tradutor/ {
    proxy_pass http://127.0.0.1:8790/;   # a barra no fim remove o prefixo /tradutor/
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 70s;              # o servidor espera o modelo até 60 s
    proxy_send_timeout 70s;
    client_max_body_size 128k;
}
```

Endereço do app: `https://cockpit.carzo.com.br/tradutor`

## Forma 2: subdomínio próprio (ex.: `tradutor.carzo.com.br`)

Precisa de registro DNS A apontando para a VPS e de certificado (`certbot --nginx -d tradutor.carzo.com.br`).
Um `server` novo, com o mesmo bloco, só que na raiz:

```nginx
server {
    listen 443 ssl;
    server_name tradutor.carzo.com.br;
    # ssl_certificate e ssl_certificate_key: o certbot preenche

    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 70s;
        proxy_send_timeout 70s;
        client_max_body_size 128k;
    }
}
```

Endereço do app: `https://tradutor.carzo.com.br`

## Depois de colar

```
sudo nginx -t && sudo systemctl reload nginx
```

Teste (a saúde não pede token):

```
curl https://cockpit.carzo.com.br/tradutor/saude
```

Esperado: `{"ok": true}`. Se vier página de login ou redirecionamento, o `location` está caindo no
`cockpit-auth`: ele precisa vir antes do `location /` e apontar para a 8790.

Teste com token (o token não vai para o chat nem para o histórico do terminal):

```
curl -s -H "Authorization: Bearer $(cat ~/.tradutor-token)" https://cockpit.carzo.com.br/tradutor/uso
```

Esperado: `{"ultima_hora": N, "teto": 300}`.

## Uso no dia a dia

- **Token:** `cat ~/.tradutor-token` no terminal da VPS. Cole no app; não mande pelo chat.
- **Ver o gasto:** `GET /uso` com o token (comando acima). `ultima_hora` é quantas chamadas ao modelo
  houve na última hora; `teto` é o limite (300). Passou do teto, o servidor responde 429 `{"erro":"limite"}`
  sem gastar.
- **Desligar na hora:** `touch ~/.config/agent-cockpit/tradutor-desligado`. Todo POST passa a responder 503.
- **Religar:** `rm ~/.config/agent-cockpit/tradutor-desligado`.
- **Estado do serviço:** `systemctl --user status tradutor` (com `export XDG_RUNTIME_DIR=/run/user/$(id -u)`).
- **Mudar o teto:** variável `TRADUTOR_TETO_HORA` no `tradutor.service`, depois
  `systemctl --user daemon-reload && systemctl --user restart tradutor`.
- **Privacidade:** o texto das mensagens nunca é gravado; o log guarda só rota, tempo e tamanho.
