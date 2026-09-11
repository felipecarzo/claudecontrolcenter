# HANDOFF

**Sessão:** 2026-09-11 · PC (`56665382`), a sessão que seguiu o MVP até o fim e
depois construiu o Plano de Unificação
**Último commit:** `cce65d1`, empurrado localmente, **não deu push ainda**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

Duas sessões trabalharam nos mesmos arquivos hoje, coordenadas pelo recado do
Routia: esta (`56665382`) e a do Cockpit 2 (`0174a7a8`, rota `cockpit2`). **Já
está tudo commitado**, os dois lados: nada a fazer na próxima sessão além de
`git push` quando ele pedir.

## O que esta sessão fechou, com prova

- **Os três cortes do MVP da v2**, todos medidos no painel real: 45 de 45
  peças do framework ativas nesta máquina; quadro com 0 cartões de id
  inventado (eram 152 de 226); backlog em dado em 15 projetos.
- **A causa das janelas do Edge que incomodavam ele**: não era o painel, era
  o `npm test`, que abria uma janela real a cada rodada. `CC_SEM_NAVEGADOR=1`
  trava isso em `abrirNavegador` e `abrirComoApp`, os dois, com teste.
- **O painel deixou de depender só de relato**: `src/observado.mjs` lê o
  transcrito e diz o que a sessão FEZ (arquivo escrito, teste, commit), sem
  o agente reportar. Foi de 5 para 9 de 18 sessões com trabalho visível.
- **Plano de Unificação aprovado e construído**: `src/regras.mjs`, a VPS
  declara a regra e o PC obedece na sincronia. Quatro travas, prova de ponta
  a ponta com 10 passos. `cc regras` para declarar/ver.
- **`cc sincronia`**, pedido direto dele: *"como eu garanto que funciona?!"*.
  Responde se o ciclo de 30s está ligado, e `--esperar` mostra o próximo
  envio acontecer na hora.
- **As 4 decisões que esperavam ele**, registradas: marcar tarefa pronta vira
  proposta+confirmação (CC-234, ainda B1, não construída); o raciocínio do
  Coderoom fica de lado (CC-274, KO); o Plano de Unificação aprovado (CC-440,
  OK); a sessão ociosa fica só com retomada manual (CC-457, KO).
- **Os 24 itens do jogo do inovallbond fechados**, com a frase dele como
  prova: *"o jogo ta pronto"*.

## ⚠️ Antes de mexer em código

**Duas sessões nos mesmos arquivos hoje.** `cc.mjs`, `src/web.mjs`,
`src/backlog.mjs`, `src/hooksCatalogo.mjs` têm trabalho das duas, já
combinado e commitado. Se abrir uma sessão nova, `docs/ROTAS-ATIVAS.md` tem
a rota `cockpit2` (dela) e o que sobrou livre.

**O backlog é dado agora, não texto.** `docs/backlog.jsonl` é a fonte;
`docs/ROADMAP.md` é gerado (`cc backlog gerar`). Editar o markdown à mão não
adianta, o gate recusa se os dois não baterem.

**`CC_SEM_NAVEGADOR=1`** em qualquer coisa que possa subir o painel. Regra
no `CLAUDE.md` do projeto agora, com o que foi medido.

## O que fica aberto, backend (17 itens, `node cc.mjs backlog`)

Sem decisão pendente dele: são trabalho, não escolha. Frentes: medição
(6 itens: exportar, tela do armazém, somas, calendário, tendência, tela
cheia), travas (6: taxa por 100, separar forma de julgamento, amostra
julgada, desligar as 5 maiores, achar a que barra 1 em 5, três que erraram
juntas), projetos (2: a primeira anotação virou decisão, criar projeto igual
nas duas máquinas), fundação (1: propor fechamento com confirmação, CC-234),
painel simples (1: apagar ui.html e ui_v2.html com o gate migrado antes).

## O que fica aberto, da outra sessão (Cockpit 2)

Não mexi, não sei o estado exato. Ela estava em `src/ui_cockpit2.html`
quando esta sessão encerrou. Ver `docs/produto/COCKPIT2-PESQUISA.md` e a
linha `cockpit2` em `docs/ROTAS-ATIVAS.md`.

## Arquivos a ler

- `docs/produto/MVP.md` — os três cortes da v2, aprovados
- `docs/produto/COLETOR.md` — o Plano de Unificação, aprovado
- `src/regras.mjs`, `src/observado.mjs`, `src/instalacao.mjs` — o trabalho
  desta sessão
- `docs/backlog.jsonl` — a fonte do backlog, 17 itens meus abertos
