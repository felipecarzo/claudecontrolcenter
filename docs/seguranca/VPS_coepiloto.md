# VPS_coepiloto: nada falhou, mas 2 ponto(s) pedem conferência

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 91 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://coepiloto.carzo.com.br/.

Placar: 0 não cumpre, 2 suspeito, 1 não medido, 9 cumpre, 4 não se aplica.

## O que é suspeito e pede conferência

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - tools/e2e.py:38 (atribuição literal a nome de segredo, suspeito)
  - tools/e2e.py:59 (atribuição literal a nome de segredo, suspeito)
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - src/coepiloto/dados.py:524 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - tools/motivos-ibge.py:34 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)

## O que cumpre

- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 1 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - src/coepiloto/dados.py:30 (hash forte)
  - src/coepiloto/dados.py:466 (hash forte)
  - src/coepiloto/dados.py:470 (hash forte)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://coepiloto.carzo.com.br/ respondeu 200 com Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://coepiloto.carzo.com.br/ respondeu 200 com X-Content-Type-Options: nosniff, nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://coepiloto.carzo.com.br/ respondeu 200 com frame-ancestors/X-Frame-Options: default-src 'self' http: https: data: blob: 'unsafe-inline' | DENY, SAMEORIGIN

## O que não se aplica

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - nenhum cookie é definido no código rastreado
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - nenhum cookie é definido no código rastreado
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - nenhum cookie é definido no código rastreado
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - nenhum package.json rastreado

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
