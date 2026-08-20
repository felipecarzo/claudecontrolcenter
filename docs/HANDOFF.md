# HANDOFF

**Sessão:** 2026-08-20 · Claude (Sonnet 5, `5a0496cf`) · **PC**, rota `front`
**Último commit:** `94673ef`, docs(design): a direcao do redesenho, as reguas e
as ferramentas de medida · **enviado ao GitHub**
**Branch:** `backlog/cc-46-48-49-52-53-56-65`
**VPS:** no mesmo commit, árvore limpa, painel no ar

O que aconteceu: [diario/2026-08-20.md](diario/2026-08-20.md). Ponteiro, não
relatório.

## ⚠️ Duas coisas antes de encostar em código

**1. O painel novo é o painel.** A raiz (`cockpit.carzo.com.br` e
`localhost:8099`) serve o `ui_v2.html`. O antigo continua inteiro em `/v1`, e a
troca são duas linhas em `src/web.mjs`. Mexer em `ui.html` achando que é a tela
de todo dia é trabalho jogado fora.

**2. [guias/PC-E-VPS.md](guias/PC-E-VPS.md) continua valendo.** Cinco consertos
que só fazem sentido na VPS, e desfazer volta o defeito sem erro na tela.

## Estado: backlog ZERADO, e as duas máquinas iguais

48 itens fechados (CC-168 a CC-217), cada um com o que foi feito e como foi
provado, no [ROADMAP.md](ROADMAP.md). Nada executável em aberto.

O painel novo tem **23 destinos, todos com dado real**, varridos um a um no PC
e na VPS. De manhã eram 8 de 24 com conteúdo e 16 esqueletos.

**PC e VPS estão no mesmo commit**, com a VPS de árvore limpa. Programar de lá
é seguro a partir de agora.

## Pendências de commit

Três arquivos ficam fora, e **não são desta sessão**:

| arquivo | por quê |
|---|---|
| `src/ui.html` | 63 blocos de mudança, 62 de outra sessão. O único bloco meu (CC-206) foi commitado sozinho, com `git apply --cached` |
| `src/trabalho.mjs` | outra sessão |
| `docs/BACKLOG-CAPTURA.md` | outra sessão |
| `.framework/estado.json` | estado local da máquina, muda sozinho |

Quem tem a rota desses arquivos commita junto com o resto do trabalho dele.

## O que só ele resolve

1. **Apagar o `ui.html`.** A raiz já é o painel novo; o antigo continua em
   `/v1` de propósito. É a única parte irreversível da troca, e espera ele
   rodar o novo alguns dias (CC-176).
2. **Abrir no celular e dizer se está bom de usar.** As medições em 390px
   dizem que sim; o teste que vale é o dele.
3. **Os nomes dos papéis** (Designer, Modelagem de sistema, Scrum Master,
   Depurador com Perito, Pesquisador e Revisor). A primeira lista foi
   reprovada por ser rasa; esta ele não avaliou.

## O que aprendi hoje e não pode se perder

**Backlog zerado não é produto pronto.** Depois de zerar, a revisão dele achou
quatro defeitos (CC-214 a CC-217), e **nenhum deles o gate pegaria**: clicar
num agente e ver todos de novo, o painel mostrando recado do programa como
pedido dele, e a própria trava de fluxo cobrando trabalho inexistente. São
defeitos que só aparecem para quem usa.

**A prova achou o que a leitura não acharia, três vezes:** os 26px de conteúdo
no celular, o cache de 15 segundos do escritório, e o resumo do CLI ocupando o
lugar do pedido dele. Nenhum item foi dado como feito sem subir o painel de
verdade e olhar.

**Caí na armadilha escrita no CLAUDE.md deste projeto.** `Stop-Process` falhava
calado e havia sete processos acumulados na porta 8134, todos anteriores ao
código novo. Testei cinco vezes contra código velho. A armadilha estava
escrita, com o comando certo, e eu não conferi a saída dele.

**Medir antes de inverter salvou um conserto errado.** Ia trocar o filtro do
transcript por lista de inclusão; a medição nos 266 arquivos mostrou que isso
perderia 37 mensagens, algumas dele de verdade.

## Onde as decisões novas moram

- `pintar(el, html)` em `ui_v2.html`: não escreve quando o conteúdo é igual,
  nem quando o cursor dele está dentro. É o que fez a tela parar de fugir do
  dedo.
- `post()` no mesmo arquivo: erro de rede devolve `{ ok:false, falhou:true }`,
  nunca `undefined`. Foi o defeito que já o fez concluir duas vezes que um
  recurso não existia.
- `humanText()` e a varredura no fim do `test.mjs`: o que separa o pedido dele
  do recado do programa, e a rede que avisa quando um marcador novo escapar.
- `montarComando()` em `src/paineis.mjs`: escolhe o interpretador por extensão
  e **nunca** liga `shell`. Guardado por teste.
- `VALIDADE_HERDADO_MS` e `LIMITE_ARQUIVO` em `src/federacao.mjs`: dado
  herdado tem prazo de 12h e o arquivo tem teto de 4 MB.
- `MODULOS` em `ui_v2.html`: o registro que faz a tela "Meu painel" existir.
- `backlogAberto()` em `hooks/fluxo-guard.mjs`: item de backlog tem código.

## Próximo passo exato

**No PC ou na VPS**, nesta ordem:

1. `git pull` (as duas estão em `94673ef`; confira antes de assumir).
2. `npm test`. Passa nos dois sistemas.
3. Abrir a raiz do painel e conferir que é o novo (procure a barra de baixo no
   celular, ou "Meu painel" no menu).

**Se for mexer em tela**, entre no perfil Designer (`cc framework perfil
designer`): ele exige print nas duas larguras e cobra a forma que ele nomeou.

**Se for medir tela estreita**, use `tools/capturar-tela.mjs`. Captura feita à
mão mente por 28% neste PC, e a imagem parece um celular convincente.

## Arquivos a ler

- [diario/2026-08-20.md](diario/2026-08-20.md), o dia inteiro
- [ROADMAP.md](ROADMAP.md), os 48 fechados com a prova de cada um
- [guias/PC-E-VPS.md](guias/PC-E-VPS.md), o que não desfazer
- [produto/TORRE.md](produto/TORRE.md), o estilo e as dez regras
- `AGENTS.md`, com o tamanho de tarefa que ele aceita (novo hoje)
- `CLAUDE.md`, as armadilhas que custaram tempo
