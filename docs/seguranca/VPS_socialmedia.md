# VPS_socialmedia: 4 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 22 arquivo(s) de texto rastreados pelo git. Sem endereço conhecido: os cabeçalhos HTTP não foram medidos.

Placar: 4 não cumpre, 1 suspeito, 4 não medido, 6 cumpre, 1 não se aplica.

## O que não cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - docs/guias/meta-passo-a-passo.md:61 (atribuição literal a nome de segredo, suspeito)
  - test_app.py:122 (chave de API (sk-))
- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - web.py:572 define cookie sem Secure
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - web.py:572 define cookie sem HttpOnly
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - web.py:572 define cookie sem SameSite

## O que é suspeito e pede conferência

- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - web.py:182 (consulta montada com texto variável, heurística: confira se o valor vem do usuário)

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - este projeto não tem endereço conhecido no painel, nada foi pedido
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - este projeto não tem endereço conhecido no painel, nada foi pedido
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - este projeto não tem endereço conhecido no painel, nada foi pedido

## O que cumpre

- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 1 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - web.py:61 (hash forte)
- **V5.2.4** (nível 1): sem eval() nem execução dinâmica de código
  - nenhum eval() nem new Function() no código rastreado
- **V14.5.3** (nível 1): CORS com lista de origens, não com asterisco
  - nenhum Access-Control-Allow-Origin com asterisco no código rastreado

## O que não se aplica

- **V14.2.1** (nível 1): dependências travadas por lockfile (base do V14.2.1)
  - nenhum package.json rastreado

## Como ler

- "Suspeito" é heurística: o código pode estar certo. Quem confere é gente.
- "Não medido" nunca vale como "cumpre".
- O valor de qualquer segredo achado não aparece aqui, só arquivo, linha e tipo.
