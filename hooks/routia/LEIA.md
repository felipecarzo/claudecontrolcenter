# Os hooks globais, agora versionados

Estes arquivos rodam a partir de `~/.claude/hooks/`, valem para **todos** os
projetos da máquina, e até 15/08/2026 **não existiam em repositório nenhum**.

Achado ao tentar entregar o CC-48, que precisa mudar o `rota-guard`: não dá para
mandar por PR o que não é versionado. E o risco é maior que o incômodo — o
`hooksCatalogo.mjs` deste projeto **liga e desliga cinco destes hooks pela
tela**, ou seja, o painel controla código que só existia em duas máquinas. Se
qualquer uma delas se perdesse, o Método Routia ia junto.

Varridos por segredo antes de entrar (o repositório é público): nada. Os únicos
casos de `token`/`secret` são nomes de variável de parser e a lista de padrões
que os detectores procuram.

## O que é cada um

| Arquivo | Evento | O que faz |
|---|---|---|
| `rota-guard.mjs` | PreToolUse | Recusa edição de código sem rota marcada em `docs/ROTAS-ATIVAS.md` |
| `rota-pedidos.mjs` | — | A fila de pedidos: quem foi barrado pede a rota, o dono libera |
| `routia-inicio.mjs` | SessionStart | Injeta o quadro de rotas no começo da sessão |
| `routia-fim.mjs` | Stop | Avisa o dono da rota que alguém pediu passagem |
| `git-add-guard.mjs` | PreToolUse | Bloqueia `git add .` e `git commit -a` em projeto com Routia |
| `todo-guard.mjs` | Stop | Avisa to-do aberto na entrega |

## ⚠️ Cópia, não fonte

**O que roda é `~/.claude/hooks/`.** Estes arquivos são uma cópia versionada, e
nada os sincroniza sozinho: mexer aqui não muda o comportamento da máquina, e
mexer lá não atualiza isto.

Enquanto não houver um `cc hooks sync` (não existe hoje), o combinado é editar
**aqui** e copiar para `~/.claude/hooks/` no mesmo passo — assim o repositório
continua sendo a versão de referência, que é o ponto de versionar.

Os `testar-*.sh` rodam contra o hook instalado, não contra esta cópia.
