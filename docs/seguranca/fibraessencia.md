# fibraessencia: 3 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 485 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://fibraessencia.carzo.com.br/.

Placar: 3 não cumpre, 0 suspeito, 1 não medido, 11 cumpre, 1 não se aplica.

## O que não cumpre

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - apps/fibraessencia-web/src/app/api/tour-editor-auth/route.ts:26 define cookie sem Secure
  - apps/fibraessencia-web/src/proxy.ts:109 define cookie sem Secure
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - apps/fibraessencia-web/src/app/api/tour-editor-auth/route.ts:26 define cookie sem HttpOnly
  - apps/fibraessencia-web/src/proxy.ts:109 define cookie sem HttpOnly
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - apps/fibraessencia-web/src/app/api/tour-editor-auth/route.ts:26 define cookie sem SameSite
  - apps/fibraessencia-web/src/proxy.ts:109 define cookie sem SameSite

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)

## O que cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - 485 arquivo(s) de texto lidos, nenhum padrão de segredo
- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 3 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - apps/fibraessencia-web/scripts/preparar-banco-do-cms.mjs:70 (consulta com parâmetro)
  - apps/fibraessencia-web/scripts/preparar-banco-do-cms.mjs:77 (consulta com parâmetro)
  - apps/fibraessencia-web/src/components/ui/select.tsx:4 (consulta com parâmetro)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - apps/fibraessencia-web/package.json tem lockfile rastreado
  - apps/fibraessencia-web/worker/package.json tem lockfile rastreado
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://fibraessencia.carzo.com.br/ respondeu 200 com Strict-Transport-Security: max-age=31536000; includeSubDomains
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://fibraessencia.carzo.com.br/ respondeu 200 com X-Content-Type-Options: nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://fibraessencia.carzo.com.br/ respondeu 200 com frame-ancestors/X-Frame-Options: default-src 'self'; script-src 'self' 'nonce-NjhmODMyYWQtNjIyNi00MTdlLWEzNzktMTM3ZThiYTkzZmU1' 'strict-dynamic'; style-s

## O que não se aplica

- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - apps/fibraessencia-web/scripts/testar-arquivo-geral.mjs:119 (senha tratada pelo provedor de login, fora deste código)
  - apps/fibraessencia-web/scripts/testar-decisao.mjs:75 (senha tratada pelo provedor de login, fora deste código)
  - apps/fibraessencia-web/scripts/testar-desativar-conta.mjs:57 (senha tratada pelo provedor de login, fora deste código)
  - e mais 13 ocorrência(s)

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
