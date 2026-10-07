# Teste de voo para app simples de Node (CC-895)

**O que é:** o `~/dev.sh` sobe cada projeto em `testedevoo.carzo.com.br/<nome>/`, mas só conhece
Vite, Next, Expo, Python e serviço. App de Node puro (como o Conta de Casa, um `server.js` com
Express) não tem tipo, e por isso a revisão do arquiteto sai sem o link.

**Por que não dá para resolver só daqui:** o `~/dev.sh` fica fora da área que as sessões podem
alterar. E tirar o prefixo do endereço no meio do caminho não basta: a página do app chama
`/api/...` pelo endereço absoluto, que cairia fora do prefixo.

## Parte 1: o tipo novo no `~/dev.sh` (você, uma vez)

**Onde fica:** `/home/claudedev/dev.sh`, no bloco `case "$TIPO" in`, logo depois da linha do `python)`.

**O que colar:**

    node) export PREFIXO="/$alvo" PORT="$PORTA" PORTA; CMD=(node "$(cd "$DIR" && node -p "require('./package.json').main || 'server.js'")") ;;

- `node)` é o nome do tipo, o mesmo que vai na lista de projetos;
- `PREFIXO` diz ao app em que caminho ele mora (`/conta-de-casa`);
- `PORT` é a porta que o app já lê hoje (`process.env.PORT`);
- o `node -p` lê o arquivo de entrada do `package.json` (`main`), e usa `server.js` se não houver.

**E a linha do projeto**, em `~/.config/testedevoo/projetos.txt` (esse arquivo as sessões podem escrever):

    conta-de-casa:projetos/VPS_conta-de-casa:node:5261

## Parte 2: o app aceitar o prefixo (no projeto, por uma sessão)

No `server.js` do Conta de Casa, montar tudo embaixo do prefixo e trocar os endereços absolutos
da página (`/api/...`, `/style.css`) por relativos (`api/...`, `style.css`). Em produção o
`PREFIXO` não existe e nada muda.

## Como saber que deu certo

Rodar `~/dev.sh conta-de-casa`, abrir `https://testedevoo.carzo.com.br/conta-de-casa/` no celular,
fazer login e lançar um gasto. Se a tela abre mas o gasto não salva, a Parte 2 ainda tem um
endereço absoluto.
