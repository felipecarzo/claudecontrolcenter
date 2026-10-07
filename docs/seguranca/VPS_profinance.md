# VPS_profinance: 3 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 276 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://profinance.carzo.com.br/.

Placar: 3 não cumpre, 1 suspeito, 1 não medido, 7 cumpre, 4 não se aplica.

## O que não cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - .gitleaks-baseline.json:8 (chave de API (sk-))
  - .gitleaks-baseline.json:9 (chave de API (sk-))
  - .gitleaks-baseline.json:9 (atribuição literal a nome de segredo, suspeito)
  - .gitleaks-baseline.json:28 (chave de API (sk-))
  - .gitleaks-baseline.json:29 (chave de API (sk-))
  - .gitleaks-baseline.json:29 (atribuição literal a nome de segredo, suspeito)
  - .gitleaks-baseline.json:49 (atribuição literal a nome de segredo, suspeito)
  - .gitleaks-baseline.json:69 (atribuição literal a nome de segredo, suspeito)
  - .gitleaks-baseline.json:88 (chave de API (sk-))
  - .gitleaks-baseline.json:89 (chave de API (sk-))
  - .gitleaks-baseline.json:89 (atribuição literal a nome de segredo, suspeito)
  - .gitleaks-baseline.json:109 (atribuição literal a nome de segredo, suspeito)
  - e mais 21 ocorrência(s)
- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - .env está rastreado pelo git (o conteúdo não foi aberto)
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore .env: não ignorado (.gitignore na raiz ou em .)

## O que é suspeito e pede conferência

- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - .env já foi adicionado em algum commit (git log --diff-filter=A); o conteúdo continua no histórico mesmo apagado hoje
  - .env.production já foi adicionado em algum commit (git log --diff-filter=A); o conteúdo continua no histórico mesmo apagado hoje

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)

## O que cumpre

- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - backend/app/services/auth.py:12 (hash forte)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - frontend/package.json tem lockfile rastreado
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://profinance.carzo.com.br/ respondeu 200 com Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://profinance.carzo.com.br/ respondeu 200 com X-Content-Type-Options: nosniff, nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://profinance.carzo.com.br/ respondeu 200 com frame-ancestors/X-Frame-Options: default-src 'self' http: https: data: blob: 'unsafe-inline' | SAMEORIGIN, SAMEORIGIN

## O que não se aplica

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - nenhum cookie é definido no código rastreado
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - nenhum cookie é definido no código rastreado
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - nenhum cookie é definido no código rastreado
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - nenhuma consulta SQL no código rastreado

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
