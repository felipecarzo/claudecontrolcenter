# VPS_conta-de-casa: 3 requisito(s) não cumprem

Varredura automática do OWASP ASVS 4.0, só leitura, em 2026-10-07. Gerada por `node cc.mjs seguranca varrer`. Não edite à mão.

Lidos 7 arquivo(s) de texto rastreados pelo git. Sem endereço conhecido: os cabeçalhos HTTP não foram medidos.

Placar: 3 não cumpre, 0 suspeito, 5 não medido, 7 cumpre, 1 não se aplica.

## O que não cumpre

- **V3.4.1** (nível 1): cookie definido pelo código com o atributo Secure
  - server.js:232 define cookie sem Secure
- **V3.4.2** (nível 1): cookie definido pelo código com o atributo HttpOnly
  - server.js:232 define cookie sem HttpOnly
- **V3.4.3** (nível 1): cookie definido pelo código com o atributo SameSite
  - server.js:232 define cookie sem SameSite

## O que não foi medido

- **V2.1.1** (nível 1): senha exige no mínimo 12 caracteres
  - há login com senha, mas nenhuma validação de tamanho foi reconhecida no código (pode estar no provedor de login)
- **V2.4.1** (nível 2 no catálogo): senha guardada com hash lento e salgado (bcrypt, argon2, scrypt ou PBKDF2)
  - há login com senha (server.js:195) mas nenhum hash conhecido nem provedor de login foi reconhecido
- **V14.4.5** (nível 1): resposta HTTPS traz Strict-Transport-Security (HSTS)
  - este projeto não tem endereço conhecido no painel, nada foi pedido
- **V14.4.4** (nível 1): resposta HTTPS traz X-Content-Type-Options: nosniff
  - este projeto não tem endereço conhecido no painel, nada foi pedido
- **V14.4.7** (nível 1): resposta HTTPS traz frame-ancestors (CSP) ou X-Frame-Options
  - este projeto não tem endereço conhecido no painel, nada foi pedido

## O que cumpre

- **V2.10.4** (nível 1): nenhum segredo (chave, token, chave privada) dentro do repositório
  - 7 arquivo(s) de texto lidos, nenhum padrão de segredo
- **V2.10.4** (nível 1): arquivo .env fora do controle de versão
  - git ls-files não lista nenhum .env real
- **V2.10.4** (nível 1): .env ignorado pelo .gitignore
  - git check-ignore confirma .env ignorado em 1 pasta(s)
- **V2.10.4** (nível 1): .env nunca entrou no histórico do git
  - git log --all não mostra nenhum .env adicionado
- **V5.3.4** (nível 1): consulta ao banco com parâmetros, nunca montada por concatenação de texto
  - server.js:265 (consulta sem texto variável)
  - server.js:384 (consulta sem texto variável)
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
