# VPS_inovallbond: 7 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 786 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://inovallbond.com.br/, https://app.inovallbond.com.br/.

Placar: 7 não cumpre, 3 suspeito, 1 não medido, 5 cumpre, 0 não se aplica.

## O que não cumpre

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - apps/app_inovallbond/src/app/editar/route.ts:78 define cookie sem Secure
  - apps/app_inovallbond/src/proxy.ts:16 define cookie sem Secure
  - apps/app_inovallbond/src/proxy.ts:19 define cookie sem Secure
  - apps/app_pierre/src/app/api/tour-editor-auth/route.ts:22 define cookie sem Secure
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - apps/app_inovallbond/src/app/editar/route.ts:78 define cookie sem HttpOnly
  - apps/app_inovallbond/src/proxy.ts:16 define cookie sem HttpOnly
  - apps/app_inovallbond/src/proxy.ts:19 define cookie sem HttpOnly
  - apps/app_pierre/src/app/api/tour-editor-auth/route.ts:22 define cookie sem HttpOnly
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - apps/app_inovallbond/src/proxy.ts:16 define cookie sem SameSite
  - apps/app_inovallbond/src/proxy.ts:19 define cookie sem SameSite
  - apps/app_pierre/src/app/api/tour-editor-auth/route.ts:22 define cookie sem SameSite
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - package.json declara dependências e nenhum lockfile está rastreado ao lado dele nem acima
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://inovallbond.com.br/ respondeu 410 sem Strict-Transport-Security
  - https://app.inovallbond.com.br/ respondeu 307 com Strict-Transport-Security: max-age=31536000; includeSubDomains
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://inovallbond.com.br/ respondeu 410 sem X-Content-Type-Options
  - https://app.inovallbond.com.br/ respondeu 307 com X-Content-Type-Options: nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://inovallbond.com.br/ respondeu 410 sem frame-ancestors/X-Frame-Options
  - https://app.inovallbond.com.br/ respondeu 307 com frame-ancestors/X-Frame-Options: default-src 'self'; script-src 'self' 'nonce-MTlkMWM3MDUtMWI1Mi00NGE4LWE5NjktYzNkMTE0ZTJiZjhj' 'sha256-3Ceg23k0i50Xo4xy2

## O que é suspeito e pede conferência

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - apps/app_pierre/scripts/medir-carta.mjs:37 (atribuição literal a nome de segredo, suspeito)
  - apps/app_pierre/scripts/medir-envio-escaneado.mjs:27 (atribuição literal a nome de segredo, suspeito)
  - apps/app_pierre/src/app/entrar/page.tsx:198 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/scripts/semear-demo-carta.py:31 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/scripts/semear-demonstracao.py:53 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/testar_seguranca.py:140 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/testar_seguranca.py:562 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/testar_seguranca.py:575 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/testar_seguranca.py:579 (atribuição literal a nome de segredo, suspeito)
  - apps/svc_pierre/testar_seguranca.py:587 (atribuição literal a nome de segredo, suspeito)
  - docs/BACKLOG-DESIGN.md:2419 (atribuição literal a nome de segredo, suspeito)
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - apps/svc_pierre/ata.py:203 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/caixa_email.py:671 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/caixa_email.py:674 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/caixa_email.py:675 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/caixa_email.py:676 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/caixa_email.py:960 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/crm_db.py:791 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - apps/svc_pierre/crm_db.py:1021 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - e mais 14 ocorrência(s)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - apps/app_pierre/src/proxy.ts:22 (eval ou new Function)
  - apps/painel-int/scripts/gerar-seeds.cjs:30 (eval ou new Function)
  - apps/painel-int/scripts/gerar-seeds.cjs:40 (eval ou new Function)
  - apps/painel-int/scripts/teste-contentloader.cjs:40 (eval ou new Function)
  - tools/dialogue-editor/testar-falas.cjs:30 (eval ou new Function)
  - tools/map-editor/testar-rotas.cjs:52 (eval ou new Function)
  - tools/map-editor/testar-rotas.cjs:66 (eval ou new Function)
  - tools/map-editor/teste-portais.cjs:21 (eval ou new Function)

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)

## O que cumpre

- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 5 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - apps/app_pierre/src/lib/carteira.ts:15 (hash forte)
  - apps/app_pierre/src/lib/carteira.ts:34 (hash forte)
  - apps/app_pierre/src/lib/carteira.ts:164 (hash forte)
  - e mais 11 ocorrência(s)
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
