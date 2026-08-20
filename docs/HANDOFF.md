# HANDOFF

**Sessão:** 2026-08-20 · Claude (Sonnet 5, `5a0496cf`) · **PC**, rota `front`
**Último commit:** `30d7e3e` · **nada commitado hoje**, ele não pediu
**Branch:** `backlog/cc-46-48-49-52-53-56-65`

O que aconteceu: [diario/2026-08-20.md](diario/2026-08-20.md). Ponteiro, não
relatório.

## ⚠️ Duas coisas antes de encostar em código

**1. O painel novo é o painel.** `cockpit.carzo.com.br` e `localhost:8099`
servem o `ui_v2.html`. O antigo continua inteiro em `/v1`, e a troca são duas
linhas em `src/web.mjs`. Mexer em `ui.html` achando que é a tela de todo dia
é trabalho jogado fora.

**2. [guias/PC-E-VPS.md](guias/PC-E-VPS.md) continua valendo.** Cinco
consertos que só fazem sentido na VPS, e desfazer volta o defeito sem erro na
tela.

## Estado: backlog ZERADO

44 itens fechados, do CC-168 ao CC-213, todos com o que foi feito e como foi
provado no [ROADMAP.md](ROADMAP.md). Nada executável em aberto.

O painel novo tem **23 destinos, todos com dado real**, varridos um a um no PC
e na VPS. De manhã eram 8 de 24 com conteúdo e 16 esqueletos.

## O que só ele resolve

1. **Apagar o `ui.html`.** A raiz já é o painel novo; o antigo continua em
   `/v1` de propósito. É a única parte irreversível da troca, e espera ele
   rodar o novo alguns dias (CC-176).
2. **Abrir no celular e dizer se está bom de usar.** As capturas em 390px
   dizem que sim; o teste que vale é o dele.
3. **Enviar ao remoto.** Nada foi commitado hoje: 43 arquivos mexidos na
   árvore esperando o pedido dele.
4. **Os nomes dos papéis** (Designer, Modelagem de sistema, Scrum Master,
   Depurador com Perito, Pesquisador e Revisor). A primeira lista foi
   reprovada por ser rasa; esta ele não avaliou.
5. **CC-138**: prioridade e complexidade por tarefa exigem que o agente
   declare as duas ao registrar. Vale perguntar se ele quer isso ou prefere
   estimado.

## O que aprendi hoje e não pode se perder

**A prova achou o que a leitura não acharia, duas vezes.** Os 26px de conteúdo
no celular e o cache de 15 segundos do escritório: nos dois casos o código
parecia certo e a tela mentia. Nenhum item foi dado como feito sem subir o
painel de verdade e olhar.

**Caí na armadilha escrita no CLAUDE.md deste projeto.** `Stop-Process`
falhava calado e havia sete processos acumulados na porta 8134, todos
anteriores ao código novo. Testei cinco vezes contra código velho. A armadilha
estava escrita, com o comando certo, e eu não conferi antes.

## Onde as decisões novas moram

- `pintar(el, html)` em `ui_v2.html`: não escreve quando o conteúdo é igual,
  nem quando o cursor dele está dentro. É o que fez a tela parar de fugir do
  dedo.
- `post()` no mesmo arquivo: erro de rede devolve `{ ok:false, falhou:true }`,
  nunca `undefined`. Foi o defeito que já o fez concluir duas vezes que um
  recurso não existia.
- `montarComando()` em `src/paineis.mjs`: escolhe o interpretador por extensão
  e **nunca** liga `shell`. Guardado por teste.
- `VALIDADE_HERDADO_MS` e `LIMITE_ARQUIVO` em `src/federacao.mjs`: dado
  herdado tem prazo e o arquivo tem teto.
- `MODULOS` em `ui_v2.html`: o registro que faz a tela "Meu painel" existir.

## Arquivos a ler

- [diario/2026-08-20.md](diario/2026-08-20.md), o dia inteiro
- [ROADMAP.md](ROADMAP.md), os 44 fechados com a prova de cada um
- [guias/PC-E-VPS.md](guias/PC-E-VPS.md), o que não desfazer
- `AGENTS.md`, com o tamanho de tarefa que ele aceita (novo hoje)
- `CLAUDE.md`, as armadilhas que custaram tempo
