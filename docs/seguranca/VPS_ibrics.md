# VPS_ibrics: 4 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 318 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://ibrics.carzo.com.br/.

Placar: 4 não cumpre, 2 suspeito, 0 não medido, 10 cumpre, 0 não se aplica.

## O que não cumpre

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - apps/web_ibrics/src/app/api/auth/trocar-senha/route.ts:16 aceita senha de 8 caracteres (o mínimo do ASVS é 12)
- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - apps/web_ibrics/src/app/api/tour-editor-auth/route.ts:22 define cookie sem Secure
  - apps/web_ibrics/src/app/painel/(protegida)/textos/_editor.tsx:90 define cookie sem Secure
  - apps/web_ibrics/src/app/painel/(protegida)/textos/_editor.tsx:92 define cookie sem Secure
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - apps/web_ibrics/src/app/api/tour-editor-auth/route.ts:22 define cookie sem HttpOnly
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - apps/web_ibrics/src/app/api/tour-editor-auth/route.ts:22 define cookie sem SameSite

## O que é suspeito e pede conferência

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - apps/web_ibrics/scripts/teste-ponta-a-ponta.mjs:116 (atribuição literal a nome de segredo, suspeito)
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - apps/web_ibrics/scripts/lexical-para-markdown.mjs:87 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/web_ibrics/scripts/lexical-para-markdown.mjs:92 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - apps/web_ibrics/scripts/tirar-travessao.mjs:102 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/web_ibrics/scripts/tirar-travessao.mjs:125 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/web_ibrics/scripts/tirar-travessao.mjs:138 (valores parametrizados, mas nome de coluna ou tabela é montado: confira se vem de lista fixa)
  - apps/web_ibrics/src/app/api/admin/banners/[id]/route.ts:46 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/web_ibrics/src/app/api/admin/config/route.ts:79 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/web_ibrics/src/app/api/admin/config/route.ts:84 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - e mais 17 ocorrência(s)

## O que cumpre

- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 2 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - apps/web_ibrics/scripts/criar-super-usuario.mjs:8 (hash forte)
  - apps/web_ibrics/scripts/teste-ponta-a-ponta.mjs:263 (hash forte)
  - apps/web_ibrics/src/lib/auth/senha.ts:9 (hash forte)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - apps/web_ibrics/package.json tem lockfile rastreado
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://ibrics.carzo.com.br/ respondeu 307 com Strict-Transport-Security: max-age=31536000; includeSubDomains, max-age=31536000; includeSubDomains; preload
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://ibrics.carzo.com.br/ respondeu 307 com X-Content-Type-Options: nosniff, nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://ibrics.carzo.com.br/ respondeu 307 com frame-ancestors/X-Frame-Options: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' da

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
