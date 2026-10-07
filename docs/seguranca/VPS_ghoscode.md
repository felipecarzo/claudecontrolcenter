# VPS_ghoscode: 3 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 608 arquivo(s) de texto rastreados pelo git. Endereços medidos: https://api.ghoscode.com.br/.

Placar: 3 não cumpre, 4 suspeito, 1 não medido, 4 cumpre, 4 não se aplica.

## O que não cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - n8n/qa-report-workflow.json:45 (chave service_role do Supabase)
- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - app_ghoscode/webapp/.env.production está rastreado pelo git (o conteúdo não foi aberto)
- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - code-runner/package.json declara dependências e nenhum lockfile está rastreado ao lado dele nem acima

## O que é suspeito e pede conferência

- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - app_ghoscode/webapp/.env.production já foi adicionado em algum commit (git log --diff-filter=A); o conteúdo continua no histórico mesmo apagado hoje
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - n8n/update_workflow.py:30 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - n8n/update_workflow.py:31 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - n8n/update_workflow.py:32 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
  - n8n/update_workflow.py:33 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - app_ghoscode/webapp/src/services/jsRunner.ts:52 (eval ou new Function)
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - supabase/functions/chat-professor/index.ts:5 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/check-plan/index.ts:5 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/contract-signed/index.ts:6 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/create-checkout/index.ts:12 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/delete-account/index.ts:5 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/increment-usage/index.ts:5 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/manage-subscription/index.ts:10 (origem liberada para todos; ok só se a rota for pública de propósito)
  - supabase/functions/send-verification/index.ts:6 (origem liberada para todos; ok só se a rota for pública de propósito)
  - e mais 1 ocorrência(s)

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)

## O que cumpre

- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 6 pasta(s)
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - https://api.ghoscode.com.br/ respondeu 401 com Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - https://api.ghoscode.com.br/ respondeu 401 com X-Content-Type-Options: nosniff
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - https://api.ghoscode.com.br/ respondeu 401 com frame-ancestors/X-Frame-Options: default-src 'self' http: https: data: blob: 'unsafe-inline' | SAMEORIGIN

## O que não se aplica

- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - app_ghoscode/webapp/src/components/auth/LoginForm.tsx:81 (senha tratada pelo provedor de login, fora deste código)
  - app_ghoscode/webapp/src/services/auth.ts:5 (senha tratada pelo provedor de login, fora deste código)
  - app_ghoscode/webapp/src/services/auth.ts:14 (senha tratada pelo provedor de login, fora deste código)
  - e mais 2 ocorrência(s)
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
