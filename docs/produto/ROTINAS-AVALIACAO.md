# As rotinas servem a quem? Avaliação de 13/08

Pedido do Felipe, com o critério dele:

> "vamos tambem avaliar se a end-session, a start-session e toda a estrutura de
> scrum ta sendo util e o maximo otimizado pro seu uso. o ideal é ter apenas
> guias e documentos conceituais p mim, o resto todo é documentação pra voce, e
> a gente traduz isso no CC"

Isso é uma inversão de papel, e ela dá um critério de corte que antes não
existia. Cada coisa que uma rotina escreve responde a **uma** pergunta:

> **Isso existe para o Felipe ler, ou para a próxima sessão de IA se orientar?**

Se é para ele ler, tem que ser conceito ou guia, e o resto o painel traduz. Se é
para a IA, não precisa ser bonito nem narrativo — precisa ser exato, curto e
estar onde a próxima sessão vai olhar.

Complemento a [[ROTINAS-HOJE]], que descreve **o que** as rotinas fazem. Este
documento julga **para quem**.

---

## O achado que decide sozinho: 38% do `/end-session` alimenta o vault

Medido linha a linha na versão global (259 linhas, 9 passos):

| Passo | Linhas | Escreve onde | Para quem |
|---|---|---|---|
| 5.5 — Pendências humanas → Kanban do Vault | **51** | `vault/kanban/Kanban — Dependências.md` | Felipe |
| 5.6 — Daily Log do Vault (+ bloco `{Nome do Projeto}`) | **48** | `vault/daily/YYYY-MM-DD.md` | Felipe |
| 6 — Relatório de verificação | 31 | nada (texto na tela) | Felipe |
| 7 — Commit e push | 29 | git | Felipe |
| 4 — HANDOFF | 17 | `docs/HANDOFF.md` | próxima sessão de IA |
| 4.5 — Liberar rota | 15 | `docs/ROTAS-ATIVAS.md` | outras sessões de IA |
| 1 — Estado real do repositório | 15 | nada (leitura) | a própria sessão |
| 2 — ROADMAP | — | `docs/ROADMAP.md` | os dois |
| 3 — Diário | — | `docs/diario/` | próxima sessão de IA |
| 5 — MEMORY | — | memória do projeto | próxima sessão de IA |

**Os dois maiores passos da rotina mais pesada escrevem no vault** — 99 de 259
linhas. E o vault foi esvaziado por ele no mesmo dia, com o veredito *"tá tudo
repetido ou ultrapassado"*.

### E eles continuam rodando

Prova ao vivo, na mesma sessão: o vault foi limpo às ~03:50 de 13/08. Às **04:18
e 04:21** já havia `vault/daily/2026-08-13.md` novo e
`vault/kanban/Kanban — Dependências.md` com **200 linhas**, escritos por outra
sessão (Carzo) que rodou `/end-session` normalmente.

A decisão de "parar de escrever no vault" tinha sido **documentada** num
`LEIA-ME` dentro do próprio vault. Não sobreviveu nem à limpeza, nem meia hora.

É a demonstração mais limpa possível do buraco nº 2 de [[ROTINAS-HOJE]]:
**instrução escrita é sugestão; hook é regra.** Nenhuma quantidade de documento
substitui uma linha de código que impede.

---

## Passo a passo, sob o critério novo

### O que é para a IA, e deve continuar (mas encolher)

**PASSO 1 (estado real do repositório).** Serve, mas é redundante: as regras
globais já mandam fazer isso em toda sessão, e o `/start-session` repete. Três
lugares dizendo a mesma coisa.

**PASSO 4 (HANDOFF).** É o único artefato desenhado explicitamente para a
próxima sessão. Continua sendo o de maior retorno por linha — e o CLAUDE.md
global já define bem o que ele não pode ser ("ponteiro, não relatório").

**PASSO 4.5 (liberar rota).** Serve, e já tem hook (`routia-fim`) lembrando.

**PASSO 3 e 5 (diário e memória).** Servem à IA, mas competem entre si e com o
HANDOFF: três lugares para registrar aprendizado, sem regra dizendo o que vai
para onde. Na prática, o diário virou narrativa de sessão (útil ao Felipe, não
à IA) e a memória ficou com o que é comportamental.

### O que é para o Felipe, e ele não usa

**PASSO 5.5 e 5.6 (vault).** 99 linhas, os dois maiores passos, escrevendo no
lugar que ele acabou de esvaziar. Devem sair.

O conteúdo deles não é inútil — "o que só o Felipe pode fazer" é informação
real e sem outro lugar hoje. Mas o destino estava errado: o painel já é onde
ele olha, e já tem `blockers` no protocolo do `meta.json`, que aparece no
cartão do agente. É tradução de destino, não perda de dado.

**PASSO 6 (relatório).** 31 linhas para montar um texto que ele lê uma vez e
descarta. É o candidato mais claro a "o CC traduz": o painel já sabe status,
to-dos fechados, tempo e frente.

### O que é para os dois

**PASSO 2 (ROADMAP)** e **PASSO 7 (commit)**. O roadmap é o único artefato que
os dois leem de verdade — e é a âncora do vocabulário do painel (`frente`). O
commit é o registro que nunca mente.

---

## O `/start-session` tem o problema oposto

96 linhas, e **nenhuma escrita**: só leitura e um relatório. O problema dele não
é peso, é não fazer nada de obrigatório — conforme já registrado em
[[ROTINAS-HOJE]], ele "informa e espera".

Sob o critério novo, ele é quase todo "para a IA se orientar", que é o certo. O
que sobra para decidir é se o relatório final (o bloco de meia tela) ainda vale,
agora que o cockpit do painel mostra o mesmo — projeto, frente, última
atividade, o que mudou desde a última visita.

---

## A estrutura de scrum

Herdada do `- projeto_template`: `HANDOFF`, `ROADMAP`, `SPRINT`, `BUGS`,
`TECH-DEBT`, `PRODUTO`, `INDEX`, `AGENTS`, `ROTINA`, `VIASMAP` e `sprints/`.

Dois problemas medidos:

1. **Ninguém a usa inteira.** No vault esvaziado hoje, a pasta `scrum/` tinha 15
   arquivos, e o `VIASMAP.md` estava com todas as oito vias livres, sem um único
   cruzamento documentado desde que foi criado. O `- projeto_template` ainda
   carrega tudo isso para cada projeto novo.
2. **Ela duplica o ROADMAP.** `SPRINT.md`, `sprints/sprint-NN.md` e a seção
   "Aberto" do `ROADMAP.md` respondem à mesma pergunta ("o que falta agora"), e
   nada garante que concordem.

Sob o critério do Felipe, quase tudo aí é documentação para a IA — e então não
precisa de dez arquivos com cabeçalho, precisa de um lugar exato. O
`ROADMAP.md` já é esse lugar, e é o único que o painel lê.

---

## O que a avaliação recomenda

Em ordem de retorno, e nenhuma delas é grande:

1. ✅ **Feito em 13/08 — tirar do `/end-session` os passos que alimentam o
   vault**, e mais: ao conferir, **quatro** rotinas globais escreviam lá, não
   duas.

   | Rotina | Antes | Depois | O que mudou |
   |---|---|---|---|
   | `end-session.md` | 259 | **176** | Passos 5.5 e 5.6 viram um passo só, que grava `blockers` no painel |
   | `novo-projeto.md` | 472 | **316** | O PASSO 7 criava task, nota de projeto e dois kanbans no vault — as três pastas alvo não existem mais. Virou "registrar no ROADMAP do projeto + `cc set`" |
   | `deps.md` | 108 | 106 | Escrevia no `Kanban — Dependências.md`; agora grava `blockers` |
   | `daily-log.md` | 108 | 89 | Escrevia em `vault/daily/`; agora escreve em `docs/diario/` do próprio projeto |

   **−243 linhas no total**, e nenhuma rotina global escreve mais no vault
   (conferido por varredura: só sobram as linhas que *proíbem* a escrita).
   Verificado que o destino novo funciona de ponta a ponta: `cc set` com
   `blockers` aparece no `/api/jobs` do painel.

   Uma entrada morreu junto: `/novo-projeto TK-{ID}` lia
   `vault/🎯 Tarefas/tasks/`, pasta apagada. Agora o comando avisa que aquele
   registro não existe mais e pede o nome do projeto.
2. **Trocar o PASSO 6 (relatório) por um `cc set` de fechamento.** O mesmo dado,
   num lugar que persiste e que o painel já lê, em vez de texto que rola para
   fora da tela.
3. **Decidir de uma vez a divisão diário × memória × HANDOFF.** Três destinos
   para aprendizado, sem regra. Uma frase resolve: o HANDOFF é ponteiro do
   agora, o diário é o que aconteceu, a memória é o que vale em toda sessão
   futura.
4. **Podar a estrutura de scrum no `- projeto_template`** para o que sobrevive
   ao uso: `ROADMAP.md`, `HANDOFF.md`, `diario/`. O resto entra quando o projeto
   pedir. Casa com o CC-39, que já achou o template nascendo violando o global.
5. **O que sobrar de "para o Felipe ler" vira guia ou conceito** em
   `docs/produto/` e `docs/guias/`, e o estado do dia a dia ele lê no painel.

E a lição de método, que vale mais que as cinco: **a mudança que só existe em
documento não acontece.** Os passos 5.5 e 5.6 repovoaram o vault meia hora
depois de ele ser esvaziado, porque a decisão morava num arquivo em vez de estar
na rotina.
