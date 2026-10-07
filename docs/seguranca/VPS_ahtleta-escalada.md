# VPS_ahtleta-escalada: 4 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 213 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://climbing.ahtleta.com.br/.

Placar: 4 não cumpre, 0 suspeito, 1 não medido, 7 cumpre, 4 não se aplica.

## O que não cumpre

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - src/app/trocar-senha.tsx:18 aceita senha de 6 caracteres (o mínimo do ASVS é 12)
  - src/services/estado.tsx:338 aceita senha de 6 caracteres (o mínimo do ASVS é 12)
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://climbing.ahtleta.com.br/ respondeu 200 sem Strict-Transport-Security
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://climbing.ahtleta.com.br/ respondeu 200 sem X-Content-Type-Options
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://climbing.ahtleta.com.br/ respondeu 200 sem frame-ancestors/X-Frame-Options

## O que não foi medido

- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - há login com senha (src/app/chat.tsx:41) mas nenhum hash conhecido nem provedor de login foi reconhecido

## O que cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - 213 arquivo(s) de texto lidos, nenhum padrão de segredo
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
