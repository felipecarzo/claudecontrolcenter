# VPS_ahtleta: 2 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 269 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://ahtleta.com.br/, https://app.ahtleta.com.br/.

Placar: 2 não cumpre, 1 suspeito, 1 não medido, 9 cumpre, 3 não se aplica.

## O que não cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - assets/docs/archive/SETUP_PENDENTE.md:16 (chave de API (sk-))
  - assets/docs/tech/api.md:18 (atribuição literal a nome de segredo, suspeito)
  - assets/docs/tech/api.md:25 (atribuição literal a nome de segredo, suspeito)
- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - scripts/trocar-senha.mjs:19 aceita senha de 6 caracteres (o mínimo do ASVS é 12)
  - server.js:2126 aceita senha de 6 caracteres (o mínimo do ASVS é 12)

## O que é suspeito e pede conferência

- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - server.js:176 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - server.js:289 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - server.js:375 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - server.js:531 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - server.js:667 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - server.js:759 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - server.js:1170 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - social.js:15 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - e mais 12 ocorrência(s)

## O que não foi medido

- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - há login com senha (app/screens/today.js:561) mas nenhum hash conhecido nem provedor de login foi reconhecido

## O que cumpre

- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 1 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - package.json tem lockfile rastreado
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://ahtleta.com.br/ respondeu 200 com Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  - https://app.ahtleta.com.br/ respondeu 200 com Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://ahtleta.com.br/ respondeu 200 com X-Content-Type-Options: nosniff
  - https://app.ahtleta.com.br/ respondeu 200 com X-Content-Type-Options: nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://ahtleta.com.br/ respondeu 200 com frame-ancestors/X-Frame-Options: default-src 'self' http: https: data: blob: 'unsafe-inline' | SAMEORIGIN
  - https://app.ahtleta.com.br/ respondeu 200 com frame-ancestors/X-Frame-Options: default-src 'self' http: https: data: blob: 'unsafe-inline' | SAMEORIGIN

## O que não se aplica

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - nenhum cookie é definido no código rastreado
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - nenhum cookie é definido no código rastreado
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - nenhum cookie é definido no código rastreado

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
